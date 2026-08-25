import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function db() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Payment service is not configured.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('audit_id')
  const cookie = (await cookies()).get('purchase_access')?.value
  const [cookieId, token] = cookie?.split(':') ?? []
  if (!id || id !== cookieId || !token) return NextResponse.json({ error: 'Purchase session not found.' }, { status: 404 })
  try {
    const hash = createHash('sha256').update(token).digest('hex')
    const { data, error } = await db().from('audits').select('id,status,score,findings').eq('id', id).eq('report_access_token_hash', hash).maybeSingle()
    if (error || !data) return NextResponse.json({ error: 'Purchase session not found.' }, { status: 404 })
    return NextResponse.json({ id: data.id, status: data.status, score: data.score, reportReady: data.status === 'ready', reportUrl: data.status === 'ready' ? `/results/${data.id}?token=${encodeURIComponent(token)}` : null })
  } catch { return NextResponse.json({ error: 'Payment status is temporarily unavailable.' }, { status: 503 }) }
}
