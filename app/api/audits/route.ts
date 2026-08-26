import { createHash, randomBytes } from 'node:crypto'
import dns from 'node:dns/promises'
import net from 'node:net'
import { createClient } from '@supabase/supabase-js'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function adminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Audit service is not configured.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function privateIp(address: string) {
  if (net.isIPv4(address)) return /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(address)
  if (net.isIPv6(address)) return address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:')
  return true
}

async function normalizeUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Enter a valid business website.')
  const raw = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`
  const parsed = new URL(raw)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.port) throw new Error('Enter a public http(s) website.')
  if (parsed.hostname === 'localhost' || !parsed.hostname.includes('.')) throw new Error('Enter a public website hostname.')
  const addresses = await dns.lookup(parsed.hostname, { all: true })
  if (!addresses.length || addresses.some(({ address }) => privateIp(address))) throw new Error('That website is not publicly reachable.')
  parsed.hash = ''
  return parsed.toString().replace(/\/$/, '')
}

function text(value: unknown, fallback = '') { return typeof value === 'string' ? value.trim().slice(0, 240) : fallback }
function queriesFor(category: string, location: string, service: string) {
  const subject = category || 'business'
  return [...new Set([`best ${subject} in ${location}`, `top ${subject} in ${location}`, `recommended ${subject} in ${location}`, service && `best ${service} in ${location}`, `best ${subject} near ${location}`, `top-rated ${subject} in ${location}`, `where to find ${subject} in ${location}`, `${subject} companies ${location}`].filter(Boolean))]
}
function scoreAudit(queries: Array<{ results: Array<{ title?: string; link?: string; snippet?: string }> }>, business: string, website: string) {
  const valid = queries.filter((query) => query.results.length)
  if (!valid.length) return null
  const domain = new URL(website).hostname.replace(/^www\./, '')
  const businessNeedle = business.toLowerCase()
  const mentions = valid.filter(({ results }) => results.some((result) => `${result.title ?? ''} ${result.link ?? ''} ${result.snippet ?? ''}`.toLowerCase().includes(businessNeedle))).length
  const top = valid.filter(({ results }) => `${results[0]?.title ?? ''} ${results[0]?.link ?? ''}`.toLowerCase().includes(businessNeedle)).length
  const citations = valid.filter(({ results }) => results.some((result) => (result.link ?? '').toLowerCase().includes(domain))).length
  return Math.round((mentions / valid.length) * 55 + (top / valid.length) * 25 + (citations / valid.length) * 20)
}

const interpretationSchema = z.object({
  summary: z.string().min(1).max(1200),
  key_findings: z.array(z.string().min(1).max(500)).max(8),
  competitor_observations: z.array(z.string().min(1).max(500)).max(8),
  brand_accuracy_observations: z.array(z.string().min(1).max(500)).max(8),
  opportunities: z.array(z.string().min(1).max(500)).max(8),
  prioritized_actions: z.array(z.string().min(1).max(500)).max(8),
})

type Interpretation = z.infer<typeof interpretationSchema>

function geminiDiagnostic(error: unknown) {
  const candidate = error as { status?: number; statusCode?: number; statusText?: string; message?: string; code?: string; responseBody?: unknown }
  let providerMessage = candidate.message ?? 'Unknown Gemini provider error.'
  let providerCode = candidate.code
  if (typeof candidate.responseBody === 'string') {
    try {
      const parsed = JSON.parse(candidate.responseBody) as { error?: { code?: string; message?: string; status?: string } }
      providerCode = providerCode ?? parsed.error?.status ?? (parsed.error?.code ? String(parsed.error.code) : undefined)
      providerMessage = parsed.error?.message ?? providerMessage
    } catch {}
  }
  return {
    reachedGemini: Boolean(candidate.status || candidate.statusCode || candidate.responseBody),
    httpStatus: candidate.statusCode ?? candidate.status ?? null,
    statusText: candidate.statusText ?? null,
    providerCode: providerCode ?? null,
    providerMessage: providerMessage.slice(0, 500),
    model: 'gemini-1.5-flash',
  }
}

async function interpretEvidence(evidence: unknown): Promise<Interpretation | null> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY_2
  if (!key) throw new Error('Gemini is not configured on the server. GEMINI_API_KEY is unavailable to the running server process.')
  try {
    const response = await generateText({
      model: createGoogleGenerativeAI({ apiKey: key })('gemini-1.5-flash'),
      temperature: 0,
      maxOutputTokens: 2400,
      prompt: `Interpret only the factual search evidence below. Do not invent entities, facts, competitors, citations, scores, or results. If evidence is absent, say so. Return JSON only with exactly these keys: summary (string), key_findings (string[]), competitor_observations (string[]), brand_accuracy_observations (string[]), opportunities (string[]), prioritized_actions (string[]).\n\nEVIDENCE:\n${JSON.stringify(evidence)}`,
    })
    const clean = response.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    return interpretationSchema.parse(JSON.parse(clean))
  } catch (error) {
    const diagnostic = geminiDiagnostic(error)
    console.error('[v0] Gemini interpretation unavailable', diagnostic)
    return null
  }
}

export async function POST(request: Request) {
  let auditId: string | undefined
  try {
    const body = await request.json()
    const businessName = text(body?.businessName ?? body?.business_name)
    const location = text(body?.location)
    const country = text(body?.country)
    const category = text(body?.category)
    const mainService = text(body?.mainService ?? body?.main_service)
    if (!businessName || !location || !country || !category) return NextResponse.json({ error: 'Business name, location, country, and category are required.' }, { status: 400 })
    const websiteUrl = await normalizeUrl(body?.website ?? body?.url ?? body?.domain)
    const email = text(body?.email, '').toLowerCase() || null
    const supabase = adminClient()
    const accessToken = randomBytes(32).toString('hex')
    const accessTokenHash = createHash('sha256').update(accessToken).digest('hex')
    const { data: audit, error: insertError } = await supabase.from('audits').insert({ business_name: businessName, website_url: websiteUrl, location, country, category, main_service: mainService || null, email, status: 'processing', access_token_hash: accessTokenHash }).select('id').single()
    if (insertError || !audit) { console.error('[v0] audit insert failed', insertError?.code); return NextResponse.json({ error: 'Audit service is temporarily unavailable.' }, { status: 503 }) }
    auditId = audit.id
    const key = process.env.SERPAPI_KEY_2
    if (!key) throw new Error('SerpApi is not configured on the server. SERPAPI_KEY is unavailable to the running server process.')
    const queryResults: Array<{ query: string; results: Array<{ title?: string; link?: string; snippet?: string }>; unavailable?: boolean; provider_error?: string }> = []
    let providerFailure = ''
    for (const query of queriesFor(category, location, mainService)) {
      let response: Response
      let data: Record<string, unknown>
      try {
        response = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(key)}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
        data = await response.json().catch(() => ({})) as Record<string, unknown>
      } catch (providerError) {
        providerFailure = providerError instanceof Error ? providerError.message : 'SerpApi request failed.'
        queryResults.push({ query, results: [], unavailable: true, provider_error: 'SerpApi could not be reached.' })
        continue
      }
      const apiError = typeof data.error === 'string' ? data.error : ''
      if (!response.ok || apiError) providerFailure = apiError || `SerpApi returned HTTP ${response.status}.`
      queryResults.push({ query, results: Array.isArray(data.organic_results) ? data.organic_results.slice(0, 10) as Array<{ title?: string; link?: string; snippet?: string }> : [], unavailable: !response.ok || Boolean(apiError), provider_error: apiError || (!response.ok ? `SerpApi returned HTTP ${response.status}.` : undefined) })
    }
    if (providerFailure && queryResults.every((item) => item.unavailable)) throw new Error(`SerpApi error: ${providerFailure}`)
    const score = scoreAudit(queryResults, businessName, websiteUrl)
    const interpretation = await interpretEvidence({ business_name: businessName, website_url: websiteUrl, location, country, category, main_service: mainService || null, query_results: queryResults })
    const findings = {
      business_name: businessName, website_url: websiteUrl, location, country, main_service: mainService || null,
      queries_analyzed: queryResults.length,
      raw_search_evidence: queryResults,
      query_results: queryResults,
      deterministic_score_inputs: { valid_queries: queryResults.filter((query) => query.results.length).length, mentions_weight: 55, top_result_weight: 25, citations_weight: 20 },
      ai_interpretation: interpretation,
      ai_interpretation_status: interpretation ? 'available' : 'unavailable',
      note: score === null ? 'Not enough data to calculate a reliable score.' : providerFailure ? 'Some SerpApi queries were unavailable.' : null,
    }
    const { error: updateError } = await supabase.from('audits').update({ status: 'ready', score, findings, updated_at: new Date().toISOString() }).eq('id', auditId)
    if (updateError) throw updateError
    return NextResponse.json({ auditId, accessToken, status: 'ready' })
  } catch (error) {
    console.error('[v0] audit processing failed', error instanceof Error ? error.message : 'unknown')
    if (auditId) { try { await adminClient().from('audits').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', auditId) } catch {} }
    const message = error instanceof Error ? error.message : ''
    const safeError = message.startsWith('Enter') || message.includes('public website') || message.startsWith('SerpApi is not configured') || message.startsWith('SerpApi error:')
      ? message
      : 'The audit provider is unavailable right now. No score or results were generated; please try again later.'
    return NextResponse.json({ error: safeError, auditId }, { status: 502 })
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  if (params.get('diagnostic') === 'serpapi') {
    const key = process.env.SERPAPI_KEY_2
    return NextResponse.json({ configured: Boolean(key), keyLength: key?.length ?? 0 })
  }
  const id = params.get('id'); const token = params.get('token')
  if (!id) return NextResponse.json({ error: 'Missing audit ID.' }, { status: 400 })

  try {
    const db = adminClient()
    if (!token) {
      const { data, error } = await db.from('audits').select('id,status,score,findings,created_at').eq('id', id).in('status', ['ready', 'completed']).maybeSingle()
      if (error || !data) return NextResponse.json({ error: 'Audit not found or requires authorization.' }, { status: 404 })
      return NextResponse.json(data)
    }

    const hash = createHash('sha256').update(token).digest('hex')
    const { data, error } = await db.from('audits').select('id,status,score,findings,created_at').eq('id', id).or(`access_token_hash.eq.${hash},report_access_token_hash.eq.${hash}`).maybeSingle()
    if (error || !data) return NextResponse.json({ error: 'Audit not found.' }, { status: 404 })
    return NextResponse.json(data)
  } catch { return NextResponse.json({ error: 'Audit service is temporarily unavailable.' }, { status: 503 }) }
}
