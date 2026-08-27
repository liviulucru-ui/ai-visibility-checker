import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Re-add verifySale as a strict security measure
function expectedPermalink() {
  const productCandidates = [process.env.GUMROAD_PRODUCT_URL_2].filter((value): value is string => Boolean(value))
  for (const productUrl of productCandidates) {
    try {
      const permalink = new URL(productUrl).pathname.split('/').filter(Boolean).at(-1)
      if (permalink === 'wgudko') return permalink
    } catch {
      continue
    }
  }
  return null
}

async function verifySale(saleId: string) {
  const accessToken = process.env.GUMROAD_ACCESS_TOKEN_2
  if (!accessToken) return { ok: false, unavailable: true as const }
  const response = await fetch(`https://api.gumroad.com/v2/sales/${encodeURIComponent(saleId)}?access_token=${encodeURIComponent(accessToken)}`, { cache: 'no-store' })
  if (!response.ok) return { ok: false, unavailable: false as const }
  const payload = await response.json().catch(() => null)
  const sale = payload?.sale ?? payload
  const permalink = sale?.product?.permalink ?? sale?.product_permalink ?? sale?.permalink
  const currency = String(sale?.currency ?? sale?.currency_type ?? '').toUpperCase()
  const price = Number(sale?.price)
  const expected = expectedPermalink()
  const customFields = sale?.custom_fields ?? sale?.custom_fields_values ?? {}
  const verifiedAuditId = customFields.audit_id ?? customFields.auditId ?? sale?.audit_id
  return {
    ok: Boolean(
      sale?.id === saleId &&
      !sale?.refunded &&
      (!expected || permalink === expected) &&
      price === 1900 &&
      currency === 'USD'
    ),
    unavailable: false as const,
    auditId: typeof verifiedAuditId === 'string' ? verifiedAuditId : null,
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { audit_id, sale_id } = body;

    if (!audit_id) {
      return NextResponse.json({ success: false, error: 'missing_audit_id' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Verify Session] Missing Supabase credentials');
      return NextResponse.json({ success: false, error: 'config_error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { data: audit, error: fetchError } = await supabaseAdmin
      .from('audits')
      .select('id,status,is_paid,findings,gumroad_sale_id')
      .eq('id', audit_id)
      .single();

    if (fetchError || !audit) {
      return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
    }

    // A better approach to secure the endpoint without relying on sale_id from the client
    // is to have the server check the database for verified payments associated with the audit_id.
    // If the audit is already marked as paid (e.g. by the webhook), we can safely unlock the session.
    let isPaymentVerified = audit.is_paid;

    // If it's not already verified and we have a sale_id from the client, try to verify it with Gumroad
    if (!isPaymentVerified && sale_id) {
      const verification = await verifySale(sale_id);

      if (verification.unavailable) {
         // Silently proceed; let polling continue rather than fail hard
      } else if (verification.ok && verification.auditId === audit_id) {
         isPaymentVerified = true;
      }
    }

    if (!isPaymentVerified) {
       // Return success: false but do not throw 400, just say it's not verified yet
       return NextResponse.json({ success: false, is_paid: false });
    }

    // Force unlock server-side immediately so the user isn't stuck waiting for the webhook
    const isMissingDeepAudit = (!audit.findings || !(audit.findings as any).ai_interpretation?.engine_readiness);

    const { error: updateError } = await supabaseAdmin
      .from('audits')
      .update({
        is_paid: true,
        gumroad_sale_id: sale_id || audit.gumroad_sale_id,
        status: isMissingDeepAudit ? 'payment_verified' : 'ready',
        payment_verified_at: new Date().toISOString()
      })
      .eq('id', audit_id);

    if (updateError) {
      throw updateError;
    }

    if (isMissingDeepAudit) {
      const { processAudit } = await import('@/lib/audits/processor');
      const { waitUntil } = await import('@vercel/functions');
      waitUntil((async () => {
        try {
          await processAudit(audit_id);
        } catch (err) {
          console.error('[Verify Session] Deep audit generation failed', err);
        }
      })());
      return NextResponse.json({ success: true, processing: true, is_paid: true });
    }

    return NextResponse.json({ success: true, redirect_url: `/results/${audit_id}?paid=true`, is_paid: true });

  } catch (error) {
    console.error('[Verify Session Error]', error);
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 });
  }
}
