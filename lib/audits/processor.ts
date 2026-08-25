import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const schema = z.object({
  summary: z.string().min(1).max(1200),
  key_findings: z.array(z.string().min(1).max(500)).max(8),
  competitor_observations: z.array(z.string().min(1).max(500)).max(8),
  brand_accuracy_observations: z.array(z.string().min(1).max(500)).max(8),
  opportunities: z.array(z.string().min(1).max(500)).max(8),
  prioritized_actions: z.array(z.string().min(1).max(500)).max(8),
})

function adminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Audit service is not configured.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function queries(category: string, location: string, service: string) {
  return [...new Set([`best ${category || 'business'} in ${location}`, `top ${category || 'business'} in ${location}`, `recommended ${category || 'business'} in ${location}`, service && `best ${service} in ${location}`, `best ${category || 'business'} near ${location}`, `top-rated ${category || 'business'} in ${location}`, `where to find ${category || 'business'} in ${location}`, `${category || 'business'} companies ${location}`].filter(Boolean))] as string[]
}

function score(items: Array<{ results: Array<{ title?: string; link?: string; snippet?: string }> }>, business: string, website: string) {
  const valid = items.filter((item) => item.results.length)
  if (!valid.length) return null
  const domain = new URL(website).hostname.replace(/^www\./, '')
  const needle = business.toLowerCase()
  const mentions = valid.filter(({ results }) => results.some((r) => `${r.title ?? ''} ${r.link ?? ''} ${r.snippet ?? ''}`.toLowerCase().includes(needle))).length
  const top = valid.filter(({ results }) => `${results[0]?.title ?? ''} ${results[0]?.link ?? ''}`.toLowerCase().includes(needle)).length
  const citations = valid.filter(({ results }) => results.some((r) => (r.link ?? '').toLowerCase().includes(domain))).length
  return Math.round((mentions / valid.length) * 55 + (top / valid.length) * 25 + (citations / valid.length) * 20)
}

export async function processAudit(auditId: string) {
  const db = adminClient()
  const { data: audit, error } = await db.from('audits').select('*').eq('id', auditId).maybeSingle()
  if (error || !audit) throw new Error('Audit not found.')
  if (audit.status === 'ready') return { status: 'ready' as const, skipped: true }
  if (audit.status === 'processing') return { status: 'processing' as const, skipped: true }
  const { error: claimError, count: claimed } = await db.from('audits').update({ status: 'processing', updated_at: new Date().toISOString() }, { count: 'exact' }).eq('id', auditId).eq('status', 'payment_verified')
  if (claimError) throw claimError
  if (claimed !== 1) return { status: 'processing' as const, skipped: true }
  const key = process.env.SERPAPI_KEY_2
  if (!key) throw new Error('SerpApi is not configured on the server.')
  const queryResults: Array<{ query: string; results: Array<{ title?: string; link?: string; snippet?: string }>; unavailable?: boolean; provider_error?: string }> = []
  for (const query of queries(audit.category, audit.location, audit.main_service ?? '')) {
    try {
      const response = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(key)}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
      const data = await response.json().catch(() => ({})) as Record<string, unknown>
      const providerError = typeof data.error === 'string' ? data.error : !response.ok ? `SerpApi returned HTTP ${response.status}.` : undefined
      queryResults.push({ query, results: Array.isArray(data.organic_results) ? data.organic_results.slice(0, 10) as Array<{ title?: string; link?: string; snippet?: string }> : [], unavailable: Boolean(providerError), provider_error: providerError })
    } catch { queryResults.push({ query, results: [], unavailable: true, provider_error: 'SerpApi could not be reached.' }) }
  }
  if (queryResults.every((item) => item.unavailable)) throw new Error('SerpApi did not return usable results.')
  let interpretation: z.infer<typeof schema> | null = null
  const geminiKey = process.env.GEMINI_API_KEY_2
  if (geminiKey) {
    try {
      const response = await generateText({ model: createGoogleGenerativeAI({ apiKey: geminiKey })('gemini-3.6-flash'), temperature: 0, maxOutputTokens: 2400, prompt: `Interpret only this factual search evidence. Return JSON with exactly summary, key_findings, competitor_observations, brand_accuracy_observations, opportunities, prioritized_actions. Evidence:\n${JSON.stringify({ business_name: audit.business_name, website_url: audit.website_url, query_results: queryResults })}` })
      interpretation = schema.parse(JSON.parse(response.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')))
    } catch (error) { console.error('[v0] paid Gemini interpretation unavailable', error instanceof Error ? error.message : 'unknown') }
  }
  const findings = { business_name: audit.business_name, website_url: audit.website_url, location: audit.location, country: audit.country, main_service: audit.main_service, queries_analyzed: queryResults.length, raw_search_evidence: queryResults, query_results: queryResults, deterministic_score_inputs: { valid_queries: queryResults.filter((q) => q.results.length).length, mentions_weight: 55, top_result_weight: 25, citations_weight: 20 }, ai_interpretation: interpretation, ai_interpretation_status: interpretation ? 'available' : 'unavailable' }
  const finalScore = score(queryResults, audit.business_name, audit.website_url)
  const { error: updateError } = await db.from('audits').update({ status: 'ready', score: finalScore, findings, updated_at: new Date().toISOString() }).eq('id', auditId).eq('status', 'processing')
  if (updateError) throw updateError
  return { status: 'ready' as const, skipped: false }
}
