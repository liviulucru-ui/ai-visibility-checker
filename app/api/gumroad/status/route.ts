import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { processAudit } from '@/lib/audits/processor'
import { waitUntil } from '@vercel/functions'

export const runtime = 'nodejs'

function db() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Payment service is not configured.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const auditId = searchParams.get('audit_id')
  const saleId = searchParams.get('sale_id')
  const cookie = (await cookies()).get('purchase_access')?.value
  const [cookieId, token] = cookie?.split(':') ?? []

  const targetId = auditId || cookieId
  if (!targetId || !token) return NextResponse.json({ error: 'Purchase session not found.' }, { status: 404 })

  try {
    const hash = createHash('sha256').update(token).digest('hex')

    let query = db().from('audits').select('id,status,score,findings').eq('report_access_token_hash', hash)
    if (saleId && targetId) {
       query = query.or(`id.eq.${targetId},gumroad_sale_id.eq.${saleId}`)
    } else if (targetId) {
       query = query.eq('id', targetId)
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error || !data) return NextResponse.json({ error: 'Purchase session not found.' }, { status: 404 })

    if (data.status === 'payment_verified') {
      waitUntil((async () => {
        try {
          await processAudit(data.id)
        } catch (processingError) {
          console.error('[v0] self-healing audit processing failed', processingError instanceof Error ? processingError.message : 'unknown')
        }
      })())
      return NextResponse.json({
        id: data.id,
        auditId: data.id,
        status: 'processing',
        score: data.score,
        ready: false,
        reportReady: false,
        reportUrl: null
      })
    }

    return NextResponse.json({
      id: data.id,
      auditId: data.id,
      status: data.status,
      score: data.score,
      ready: data.status === 'ready',
      reportReady: data.status === 'ready',
      reportUrl: data.status === 'ready' ? `/results/${data.id}?token=${encodeURIComponent(token)}` : null
    })
  } catch { return NextResponse.json({ error: 'Payment status is temporarily unavailable.' }, { status: 503 }) }
}
