import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function adminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Payment service is not configured.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 240) : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const businessName = clean(body?.businessName)
    const websiteUrl = clean(body?.websiteUrl)
    const location = clean(body?.location)
    const country = clean(body?.country)
    const category = clean(body?.category)
    const email = clean(body?.email).toLowerCase()
    if (!businessName || !websiteUrl || !location || !country || !category || !email) {
      return NextResponse.json({ error: 'All report details are required.' }, { status: 400 })
    }
    const parsed = new URL(/^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.port) throw new Error('Enter a public http(s) website.')
    parsed.hash = ''
    const url = parsed.toString().replace(/\/$/, '')
    const reportToken = randomBytes(32).toString('hex')
    const reportTokenHash = createHash('sha256').update(reportToken).digest('hex')
    const supabase = adminClient()
    const { data, error } = await supabase.from('audits').insert({
      business_name: businessName,
      website_url: url,
      location,
      country,
      category,
      email,
      status: 'queued',
      report_access_token_hash: reportTokenHash,
    }).select('id').single()
    if (error || !data) return NextResponse.json({ error: 'Payment service is temporarily unavailable.' }, { status: 503 })
    const productUrl = process.env.GUMROAD_PRODUCT_URL_2
    if (!productUrl) return NextResponse.json({ error: 'Missing required server variable: GUMROAD_PRODUCT_URL_2.', auditId: data.id }, { status: 503 })
    let checkout: URL
    try {
      checkout = new URL(productUrl)
    } catch {
      return NextResponse.json({ error: 'Configured Gumroad product URL is invalid.', auditId: data.id }, { status: 503 })
    }
    if (checkout.pathname.split('/').filter(Boolean).at(-1) !== 'wgudko') return NextResponse.json({ error: 'Configured Gumroad product URL must point to permalink wgudko.', auditId: data.id }, { status: 503 })
    checkout.searchParams.set('wanted', 'true')
    // Gumroad receives only the opaque audit UUID for correlation. Never place
    // the report access token in a third-party checkout URL.
    checkout.searchParams.set('audit_id', data.id)
    checkout.searchParams.set('email', email)
    checkout.searchParams.set('return_to', `${new URL(request.url).origin}/buy/complete?audit_id=${encodeURIComponent(data.id)}`)
    const response = NextResponse.json({ checkoutUrl: checkout.toString(), auditId: data.id })
    response.cookies.set('purchase_access', `${data.id}:${reportToken}`, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })
    return response
  } catch (error) {
    const message = error instanceof Error && error.message.includes('public') ? error.message : 'Unable to prepare checkout.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST to prepare checkout.' }, { status: 405 })
}

// The opaque report token is returned only to the initiating browser and stored as a hash.
// It is never used as proof of payment; Gumroad verification remains authoritative.
// For production, configure Gumroad's Ping URL to /api/gumroad/webhook.
