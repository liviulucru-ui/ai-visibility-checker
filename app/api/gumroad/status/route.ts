import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const auditId = searchParams.get('audit_id');
    const saleId = searchParams.get('sale_id');

    if (!auditId && !saleId) {
      return NextResponse.json({ success: false, status: 'missing_params', ready: false }, { status: 200 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Gumroad Status] Missing Supabase credentials in environment');
      return NextResponse.json({ success: false, status: 'config_error', ready: false }, { status: 200 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase.from('audits').select('*');
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
    const isReady = audit.status === 'ready' || audit.status === 'completed' || Boolean(audit.findings);

    if (isReady) {
      return NextResponse.json({
        success: true,
        status: 'ready',
        auditId: audit.id,
        ready: true,
        hasReport: Boolean(audit.findings)
      }, { status: 200 });
    }

    // Self-healing: if stuck in queued or processing with no findings, trigger generation
    if ((audit.status === 'queued' || audit.status === 'processing' || audit.status === 'payment_verified') && !audit.findings) {
      const { processAudit } = await import('@/lib/audits/processor');
      const { waitUntil } = await import('@vercel/functions');

      waitUntil((async () => {
        try {
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
