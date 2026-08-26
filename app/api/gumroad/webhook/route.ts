import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { processAudit } from '@/lib/audits/processor'
import { waitUntil } from '@vercel/functions'

export const runtime = 'nodejs'
export const maxDuration = 60

const GUMROAD_SELLER_ID = '_awS5EayMAyhC6mFIDzEvw=='

function adminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Payment service is not configured.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function clean(value: string | null) {
  return (value ?? '').trim().slice(0, 240)
}

function diagnostic(
  request: Request,
  form: URLSearchParams,
  branch: string,
) {
  return NextResponse.json({
    error: 'Gumroad notification rejected.',
    diagnostic: {
      method: request.method,
      content_type: request.headers.get('content-type')?.toLowerCase() ?? '',
      field_names: [...new Set([...form.keys()])].sort(),
      has_seller_id: form.has('seller_id'),
      has_sale_id: form.has('sale_id'),
      has_resource_name: form.has('resource_name') || form.has('resource'),
      has_product_permalink: form.has('product_permalink'),
      validation_branch: branch,
    },
  }, { status: 400 })
}

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

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
    let form: URLSearchParams

    if (contentType.includes('application/json')) {
      const json = await request.json().catch(() => ({}))
      form = new URLSearchParams(Object.entries(json))
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData().catch(() => null)
      form = new URLSearchParams()
      if (formData) {
        for (const [key, value] of formData.entries()) {
          form.set(key, value.toString())
        }
      }
    } else {
      const text = await request.text().catch(() => '')
      form = new URLSearchParams(text)
    }

    const sellerId = clean(form.get('seller_id'))
    const saleId = clean(form.get('sale_id'))
    const resourceName = clean(form.get('resource_name') || form.get('resource')).toLowerCase()
    const isTestNotification = form.get('test')?.trim().toLowerCase() === 'true'

    // Reject arbitrary POSTs and malformed notifications before any privileged
    // work. Gumroad includes seller_id on its Ping payloads.
    if (sellerId !== GUMROAD_SELLER_ID) {
      return diagnostic(request, form, 'invalid_seller_id')
    }

    // Gumroad's dashboard test sends the most recent sale as form data and sets
    // test=true, so it may contain sale_id and real sale fields. A valid test
    // notification is acknowledged without payment verification or side effects.
    if (isTestNotification) {
      return NextResponse.json({ received: true, test: true }, { status: 200 })
    }

    // Only sale notifications can begin fulfillment. Other authenticated Ping
    // resources are acknowledged safely but never unlock or create a report.
    if (resourceName && resourceName !== 'sale') {
      return NextResponse.json({ received: true, ignored: true }, { status: 200 })
    }

    if (!saleId) {
      return diagnostic(request, form, 'missing_sale_id')
    }

    const verification = await verifySale(saleId)
    if (verification.unavailable) return NextResponse.json({ error: 'Payment verification is not configured.' }, { status: 503 })
    if (!verification.ok) return diagnostic(request, form, 'sale_verification_failed')

    // Only the verified Gumroad API response may provide the association. Never
    // trust audit_id from the inbound Ping body or browser return URL.
    const auditId = verification.auditId
    if (!auditId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[4-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(auditId)) {
      return diagnostic(request, form, 'missing_verified_audit_association')
    }

    const supabase = adminClient()
    const { data: audit, error: lookupError } = await supabase.from('audits').select('id,status,gumroad_sale_id').eq('id', auditId).maybeSingle()
    if (lookupError || !audit) return NextResponse.json({ error: 'Audit could not be found.' }, { status: 404 })
    if (audit.status === 'payment_verified' || audit.status === 'ready') return NextResponse.json({ received: true, idempotent: true })
    if (audit.status === 'failed') return NextResponse.json({ error: 'Failed audits cannot be fulfilled.' }, { status: 409 })

    const now = new Date().toISOString()
    const { error } = await supabase.from('audits').update({
      gumroad_sale_id: saleId,
      payment_verified_at: now,
      status: 'processing',
      updated_at: now,
    }).eq('id', auditId).in('status', ['queued', 'payment_verified', 'processing'])
    if (error) return NextResponse.json({ error: 'Payment fulfillment failed.' }, { status: 500 })

    // Payment verification is durable before processing begins. Schedule the
    // existing processor after the response; provider failures never roll back
    // the verified payment state.
    waitUntil((async () => {
      try {
        console.log('[Webhook] Processing audit generation for auditId:', auditId)
        await processAudit(auditId)
      } catch (processingError) {
        console.error('[v0] paid audit processing failed after payment verification', processingError instanceof Error ? processingError.message : 'unknown')
        await supabase.from('audits').update({ status: 'payment_verified', updated_at: new Date().toISOString() }).eq('id', auditId).eq('status', 'processing')
      }
    })())
    return NextResponse.json({ received: true, processing_started: true }, { status: 200 })
  } catch (error) {
    console.error('[Gumroad Webhook Parse Error]', error)
    return NextResponse.json({ received: true, error: 'parse_failed' }, { status: 200 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Webhook endpoint requires POST.' }, { status: 405 })
}

// Configure Gumroad Ping to POST form data here. The browser return URL is never proof of payment.
