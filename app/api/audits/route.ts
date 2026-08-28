import { createHash, randomBytes } from 'node:crypto'
import dns from 'node:dns/promises'
import net from 'node:net'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  visibility_score: z.number().min(0).max(100),
  summary: z.string(),
  brand_presence: z.enum(["High", "Medium", "Low", "Not Found"]),
  top_competitors: z.array(
    z.object({
      name: z.string(),
      domain: z.string(),
      strengths: z.string()
    })
  ),
  ai_readiness_breakdown: z.object({
    chatgpt_visibility: z.string(),
    perplexity_search_rank: z.string(),
    google_gemini_presence: z.string()
  }),
  actionable_recommendations: z.array(
    z.object({
      priority: z.enum(["High", "Medium"]),
      action: z.string(),
      impact: z.string()
    })
  )
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
    model: 'gemini-3.6-flash',
  }
}

export function extractCleanSearchData(rawSerpApiData: any): any {
  if (!rawSerpApiData) return [];

  if (Array.isArray(rawSerpApiData)) {
    return rawSerpApiData.map((queryResult) => ({
      query: queryResult.query,
      results: extractCleanSearchData(queryResult)
    }))
  }

  const organic = (rawSerpApiData.results || rawSerpApiData.organic_results || []).map((item: any) => ({
    title: item.title || '',
    snippet: item.snippet || '',
    link: item.link || '',
    source: item.source || item.displayed_link || ''
  }));

  const answerBox = rawSerpApiData.answer_box
    ? {
        title: rawSerpApiData.answer_box.title || '',
        snippet: rawSerpApiData.answer_box.snippet || rawSerpApiData.answer_box.answer || '',
        link: rawSerpApiData.answer_box.link || ''
      }
    : null;

  return {
    organic_results: organic.slice(0, 8),
    answer_box: answerBox
  };
}

async function interpretEvidence(evidence: unknown): Promise<Interpretation | null> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY_2
  if (!key) throw new Error('Gemini is not configured on the server. GEMINI_API_KEY is unavailable to the running server process.')

  const models = ['gemini-3.6-flash']
  let lastError: unknown

  for (const modelName of models) {
    let attempts = 0;
    while (attempts < 2) {
      try {
        const response = await generateText({
          model: createGoogleGenerativeAI({ apiKey: key })(modelName),
          temperature: 0.2,

          prompt: `You are an expert SEO and AI visibility analyst. Review this search evidence and provide a structured JSON report.
Do not invent information. Follow this JSON schema exactly without markdown formatting:
{
  "visibility_score": number (0-100),
  "summary": string,
  "brand_presence": "High" | "Medium" | "Low" | "Not Found",
  "top_competitors": [{"name": string, "domain": string, "strengths": string}],
  "ai_readiness_breakdown": {
    "chatgpt_visibility": "Low" | "Medium" | "High",
    "perplexity_search_rank": "Low" | "Medium" | "High",
    "google_gemini_presence": "Low" | "Medium" | "High"
  },
  "actionable_recommendations": [{"priority": "High" | "Medium", "action": string, "impact": string}]
}

EVIDENCE:\n${JSON.stringify({
  ...evidence as any,
  query_results: extractCleanSearchData((evidence as any).query_results)
})}`,
        })

        try {
          const clean = response.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
          return interpretationSchema.parse(JSON.parse(clean))
        } catch (parseError) {
          console.error('[v0] Gemini JSON parse failed. Raw text:', response.text)
          if (attempts === 1) throw parseError
        }
      } catch (error) {
        lastError = error
        if (attempts === 1) {
          console.warn(`[v0] Gemini interpretation failed for model ${modelName}`, geminiDiagnostic(error))
        }
      }
      attempts++
    }
  }

  console.error('[v0] Gemini interpretation unavailable after all retries', geminiDiagnostic(lastError))
  return null
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

    const accessToken = randomBytes(32).toString('hex')
    const accessTokenHash = createHash('sha256').update(accessToken).digest('hex')
    const { data: audit, error: insertError } = await supabaseAdmin.from('audits').insert({ business_name: businessName, website_url: websiteUrl, location, country, category, main_service: mainService || null, email, status: 'processing', access_token_hash: accessTokenHash }).select('id').single()
    if (insertError || !audit) { console.error('[v0] audit insert failed', insertError?.code); return NextResponse.json({ error: 'Audit service is temporarily unavailable.' }, { status: 503 }) }
    auditId = audit.id
    console.log(`AUDIT CREATED: ${auditId}`)
    console.log(`AUDIT PROCESSING: ${auditId}`)

    const key = process.env.SERPAPI_KEY_2
    if (!key) throw new Error('SerpApi is not configured on the server. SERPAPI_KEY is unavailable to the running server process.')
    const queryResults: Array<{ query: string; results: Array<{ title?: string; link?: string; snippet?: string }>; unavailable?: boolean; provider_error?: string }> = []
    let providerFailure = ''
    const generatedQueries = [...new Set([
      `"${businessName}" ${category}`,
      `best ${category} ${mainService || 'apps / platforms'} in ${country || location}`,
      `top ${category} ${country || location}`
    ].filter(Boolean))] as string[]

    for (const query of generatedQueries) {
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
    console.log(`AUDIT SERP COMPLETE: ${auditId}`)

    const score = scoreAudit(queryResults, businessName, websiteUrl)
    const interpretation = await interpretEvidence({ business_name: businessName, website_url: websiteUrl, location, country, category, main_service: mainService || null, query_results: queryResults })
    console.log(`AUDIT GEMINI COMPLETE: ${auditId}`)

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
    const { error: updateError } = await supabaseAdmin.from('audits').update({ status: 'ready', score, findings, updated_at: new Date().toISOString() }).eq('id', auditId).select().single()
    if (updateError) throw updateError
    console.log(`AUDIT READY: ${auditId}`)
    return NextResponse.json({ auditId, accessToken, status: 'ready' })
  } catch (error) {
    console.error('[v0] audit processing failed', error instanceof Error ? error.message : 'unknown')
    if (auditId) {
        try {
            await supabaseAdmin.from('audits').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', auditId)
            console.log(`AUDIT FAILED: ${auditId}`)
        } catch {}
    }
    const message = error instanceof Error ? error.message : ''
    const safeError = message.startsWith('Enter') || message.includes('public website') || message.startsWith('SerpApi is not configured') || message.startsWith('SerpApi error:')
      ? message
      : 'The audit provider is unavailable right now. No score or results were generated; please try again later.'
    return NextResponse.json({ error: safeError, auditId }, { status: 502 })
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const id = params.get('id')

  if (!id) {
      return NextResponse.json({ error: 'Audit ID required' }, { status: 400 })
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid Audit ID format' }, { status: 400 });
  }

  try {
    // 200 response for any existing audit row, avoiding token leaks unless necessary
    const { data, error } = await supabaseAdmin.from('audits').select('id,status,score,is_paid,payment_verified_at,findings,created_at,gumroad_sale_id').eq('id', id).maybeSingle()
    if (error || !data) {
        return NextResponse.json({ error: 'Audit not found.' }, { status: 404 })
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } })
  } catch {
      return NextResponse.json({ error: 'Audit service is temporarily unavailable.' }, { status: 503 })
  }
}
