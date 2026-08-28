import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 240) : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = clean(body?.email).toLowerCase()
    const auditIdInput = clean(body?.auditId)

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    if (!auditIdInput) {
      return NextResponse.json({ error: 'Audit ID is required.' }, { status: 400 })
    }

    let reportToken = randomBytes(32).toString('hex')
    let reportTokenHash = createHash('sha256').update(reportToken).digest('hex')

    const { data, error } = await supabaseAdmin.from('audits').update({ email, report_access_token_hash: reportTokenHash }).eq('id', auditIdInput).select('id').single()
    if (error || !data) return NextResponse.json({ error: 'Audit not found or could not be updated.' }, { status: 404 })
    const auditId = data.id

    const productUrl = process.env.GUMROAD_PRODUCT_URL_2
    if (!productUrl) return NextResponse.json({ error: 'Missing required server variable: GUMROAD_PRODUCT_URL_2.', auditId: auditId }, { status: 503 })

    let checkout: URL
    try {
      checkout = new URL(productUrl)
    } catch {
      return NextResponse.json({ error: 'Configured Gumroad product URL is invalid.', auditId: auditId }, { status: 503 })
    }

    if (checkout.pathname.split('/').filter(Boolean).at(-1) !== 'wgudko') return NextResponse.json({ error: 'Configured Gumroad product URL must point to permalink wgudko.', auditId: auditId }, { status: 503 })

    checkout.searchParams.set('wanted', 'true')
    // Gumroad receives only the opaque audit UUID for correlation. Never place
    // the report access token in a third-party checkout URL.
    checkout.searchParams.set('audit_id', auditId)
    checkout.searchParams.set('email', email)
    checkout.searchParams.set('return_to', `${new URL(request.url).origin}/buy/complete?audit_id=${encodeURIComponent(auditId)}`)

    const response = NextResponse.json({ checkoutUrl: checkout.toString(), auditId: auditId })
    response.cookies.set('purchase_access', `${auditId}:${reportToken}`, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })
    return response
  } catch (error) {
    const message = error instanceof Error && error.message.includes('public') ? error.message : 'Unable to prepare checkout.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST to prepare checkout.' }, { status: 405 })
}
