import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const auditId = searchParams.get('audit_id');
    const saleId = searchParams.get('sale_id');

    if (!auditId && !saleId) {
      return NextResponse.json({ success: false, status: 'missing_params', ready: false }, { status: 200 });
    }

    let query = supabaseAdmin.from('audits').select('*');
    if (auditId) {
      query = query.eq('id', auditId);
    } else if (saleId) {
      query = query.eq('gumroad_sale_id', saleId);
    }

    const { data: audits, error } = await query.limit(1);

    if (error) {
      console.error('[Gumroad Status] Supabase query error:', error);
      return NextResponse.json({ success: false, status: 'db_error', ready: false }, { status: 200 });
    }

    if (!audits || audits.length === 0) {
      return NextResponse.json({ success: false, status: 'not_found', ready: false }, { status: 200 });
    }

    const audit = audits[0];

    // Self-healing: if stuck in queued or payment_verified with no findings, trigger generation
    // Also, if paid but marked ready without the deep audit findings, trigger generation
    const isPaid = Boolean(audit.is_paid || audit.gumroad_sale_id || audit.payment_verified_at)
    const isMissingDeepAudit = isPaid && (!audit.findings || !audit.findings.ai_interpretation?.visibility_signals)

    if (((audit.status === 'queued' || audit.status === 'payment_verified') && !audit.findings) || isMissingDeepAudit) {
      const { processAudit } = await import('@/lib/audits/processor');
      const { waitUntil } = await import('@vercel/functions');

      waitUntil((async () => {
        try {
          if (isMissingDeepAudit && audit.status === 'ready') {
             await supabaseAdmin.from('audits').update({ status: 'payment_verified' }).eq('id', audit.id)
          }
          await processAudit(audit.id)
        } catch (processingError) {
          console.error('[v0] self-healing audit processing failed', processingError)
        }
      })())

      return NextResponse.json({
        success: true,
        status: 'processing',
        auditId: audit.id,
        ready: false,
        hasReport: false
      }, { status: 200 });
    }

    const isReady = audit.status === 'ready' || audit.status === 'completed' || Boolean(audit.findings) || audit.status === 'payment_verified';

    if (isReady) {
      return NextResponse.json({
        success: true,
        status: 'ready',
        auditId: audit.id,
        ready: true,
        hasReport: Boolean(audit.findings)
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      status: audit.status || 'processing',
      auditId: audit.id,
      ready: false,
      hasReport: false
    }, { status: 200 });

  } catch (err: any) {
    console.error('[Gumroad Status Unhandled Crash]:', err?.message || err);
    return NextResponse.json({ success: false, status: 'error', error: err?.message, ready: false }, { status: 200 });
  }
}
