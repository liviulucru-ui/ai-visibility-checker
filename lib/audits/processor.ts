import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const freeSchema = z.object({
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

const paidSchema = z.object({
  visibility_score: z.number().min(0).max(100),
  presence_level: z.enum(["High", "Medium", "Low", "Not Found", "Absent", "Weak", "Moderate"]),
  executive_summary: z.string(),
  executive_roi_summary: z.string().optional(),
  engine_readiness: z.object({
    chatgpt_search: z.object({ score: z.number(), status: z.string(), analysis: z.string() }),
    perplexity_ai: z.object({ score: z.number(), status: z.string(), analysis: z.string() }),
    google_ai_overview: z.object({ score: z.number(), status: z.string(), analysis: z.string() })
  }),
  commercial_queries_simulation: z.array(
    z.object({
      query: z.string(),
      why_competitors_win: z.string()
    })
  ).optional(),
  in_depth_competitors: z.array(
    z.object({
      name: z.string(),
      domain: z.string(),
      visibility_score: z.number(),
      why_ai_recommends_them: z.string(),
      content_gaps: z.string()
    })
  ),
  technical_ai_signals: z.object({
    schema_markup: z.string(),
    entity_disambiguation: z.string(),
    sentiment_and_mentions: z.string()
  }),
  ready_to_use_schema: z.string().optional(),
  action_plan_30_days: z.array(
    z.object({
      day_range: z.string(),
      priority: z.enum(["High", "Medium", "Low"]),
      action: z.string(),
      description: z.string()
    })
  )
})

function adminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Audit service is not configured.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function queries(businessName: string, category: string, location: string, service: string, country: string) {
  return [...new Set([
    `"${businessName}" ${category}`,
    `best ${category} ${service || 'apps / platforms'} in ${country || location}`,
    `top ${category} ${country || location}`
  ].filter(Boolean))] as string[]
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

export async function processAudit(auditId: string) {
  try {
    const db = adminClient()
    const { data: audit, error } = await db.from('audits').select('*').eq('id', auditId).maybeSingle()
    if (error || !audit) throw new Error('Audit not found.')

    const isPaid = Boolean(audit.is_paid || audit.gumroad_sale_id || audit.payment_verified_at)

    if (audit.status === 'ready' || audit.status === 'completed') {
      if (!isPaid || (isPaid && audit.findings && audit.findings.ai_interpretation?.engine_readiness)) {
        return { status: 'ready' as const, skipped: true }
      }
    }

    const { error: claimError, count: claimed } = await db.from('audits').update({ status: 'processing', updated_at: new Date().toISOString() }, { count: 'exact' }).eq('id', auditId).in('status', ['queued', 'payment_verified', 'ready'])
    if (claimError) throw claimError
    if (claimed !== 1) return { status: 'processing' as const, skipped: true }
  const key = process.env.SERPAPI_KEY_2
  if (!key) throw new Error('SerpApi is not configured on the server.')
  const queryResults: Array<{ query: string; results: Array<{ title?: string; link?: string; snippet?: string }>; unavailable?: boolean; provider_error?: string }> = []
  for (const query of queries(audit.business_name, audit.category, audit.location, audit.main_service ?? '', audit.country)) {
    try {
      const response = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(key)}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
      const data = await response.json().catch(() => ({})) as Record<string, unknown>
      const providerError = typeof data.error === 'string' ? data.error : !response.ok ? `SerpApi returned HTTP ${response.status}.` : undefined
      queryResults.push({ query, results: Array.isArray(data.organic_results) ? data.organic_results.slice(0, 10) as Array<{ title?: string; link?: string; snippet?: string }> : [], unavailable: Boolean(providerError), provider_error: providerError })
    } catch { queryResults.push({ query, results: [], unavailable: true, provider_error: 'SerpApi could not be reached.' }) }
  }
  if (queryResults.every((item) => item.unavailable)) throw new Error('SerpApi did not return usable results.')
  let interpretation: z.infer<typeof freeSchema> | z.infer<typeof paidSchema> | null = null
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY_2
  if (geminiKey) {
    const models = ['gemini-3.6-flash']
    for (const modelName of models) {
      let attempts = 0;
      while (attempts < 2) {
        try {
          const freePrompt = `You are an expert AI visibility analyst. Review this search evidence and provide a structured JSON diagnostic report.
Do not invent information. Follow this JSON schema exactly without markdown formatting:
{
  "visibility_score": number (0-100),
  "summary": string (1-2 sentences),
  "brand_presence": "Strong" | "Moderate" | "Low" | "Missing",
  "engine_snapshot": {
    "chatgpt": { "status": "Strong" | "Moderate" | "Low" | "Missing", "reason": string },
    "gemini": { "status": "Strong" | "Moderate" | "Low" | "Missing", "reason": string },
    "perplexity": { "status": "Strong" | "Moderate" | "Low" | "Missing", "reason": string },
    "google_ai": { "status": "Strong" | "Moderate" | "Low" | "Missing", "reason": string }
  },
  "sample_evidence": [
    {
      "query": string (A high-intent buyer query),
      "competitor_win": string (Name of competitor appearing),
      "status": "You Appear" | "Competitor Wins" | "Missing" | "Partial"
    }
  ] (Exactly 3 items),
  "top_competitors": [
    {
      "name": string,
      "domain": string,
      "winning_search": string,
      "advantage": string
    }
  ]
}
Note: You are inferring AI engine visibility based on source/citation evidence provided in the organic search results, as these engines heavily rely on top organic citations.`

          const paidPrompt = `You are an expert AI visibility analyst. Review this search evidence and provide a comprehensive structured JSON report for a Deep Audit.
Do not invent information. Use actual data from the evidence. Infer AI engine presence based on the strength and volume of citations and organic rankings.
Follow this JSON schema exactly without markdown formatting:
{
  "visibility_score": number (0-100),
  "score_breakdown": {
    "brand_presence": number,
    "buyer_search_visibility": number,
    "source_authority": number
  },
  "executive_summary": string (Concise strategic summary of overall visibility, strongest/weakest engine, and top fix),
  "engine_visibility": [
    {
      "engine": "ChatGPT" | "Gemini" | "Perplexity" | "Google AI",
      "status": "Strong" | "Moderate" | "Low" | "Missing",
      "queries_checked": number,
      "brand_wins": number,
      "competitor_wins": number,
      "strongest_competitor": string,
      "summary": string,
      "top_issue": string
    }
  ],
  "evidence_items": [
    {
      "query": string,
      "intent": string,
      "engine": string (Inferred engine),
      "your_status": "Found" | "Missing" | "Partial" | "Competitor Wins",
      "winning_competitor": string,
      "source": string
    }
  ],
  "competitor_insights": [
    {
      "name": string,
      "domain": string,
      "winning_queries": [string],
      "strongest_sources": [string],
      "advantage_summary": string
    }
  ],
  "technical_signals": [
    {
      "label": string (e.g., "Website indexed", "Organization schema", "Third-party mentions"),
      "status": "Good" | "Needs Work" | "Missing",
      "explanation": string
    }
  ],
  "action_tasks": [
    {
      "timeframe": string (e.g., "Week 1", "Week 2"),
      "priority": "High" | "Medium" | "Low",
      "action": string (Specific instruction),
      "target_location": string (Where to apply it),
      "why": string (How it affects AI discovery),
      "expected_impact": string
    }
  ],
  "ready_to_use_schema": string (Pre-generate valid JSON-LD Organization markup tailored to the client's business name and domain)
}`

          const prompt = `${isPaid ? paidPrompt : freePrompt}

Evidence:
${JSON.stringify({ business_name: audit.business_name, website_url: audit.website_url, query_results: extractCleanSearchData(queryResults) })}`

          const response = await generateText({ model: createGoogleGenerativeAI({ apiKey: geminiKey })(modelName), temperature: 0.2,  prompt })

          try {
            const clean = response.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
            interpretation = isPaid ? paidSchema.parse(JSON.parse(clean)) : freeSchema.parse(JSON.parse(clean))
            break
          } catch (parseError) {
            console.error('[v0] Gemini JSON parse failed. Raw text:', response.text)
            if (attempts === 1) throw parseError
          }
        } catch (error) {
          if (attempts === 1) {
            console.warn(`[v0] paid Gemini interpretation failed for model ${modelName}`, error instanceof Error ? error.message : 'unknown')
          }
        }
        attempts++
      }
      if (interpretation) break
    }
    if (!interpretation) {
      console.error('[v0] paid Gemini interpretation unavailable after all retries')
    }
  }
  const findings = { business_name: audit.business_name, website_url: audit.website_url, location: audit.location, country: audit.country, main_service: audit.main_service, queries_analyzed: queryResults.length, raw_search_evidence: queryResults, query_results: queryResults, deterministic_score_inputs: { valid_queries: queryResults.filter((q) => q.results.length).length, mentions_weight: 55, top_result_weight: 25, citations_weight: 20 }, ai_interpretation: interpretation, ai_interpretation_status: interpretation ? 'available' : 'unavailable' }
    const finalScore = score(queryResults, audit.business_name, audit.website_url)
    const { error: updateError } = await db.from('audits').update({ status: 'ready', score: finalScore, findings, updated_at: new Date().toISOString() }).eq('id', auditId)
    if (updateError) throw updateError
    return { status: 'ready' as const, skipped: false }
  } catch (err) {
    console.error('[Full Audit Generation Error]', err)
    throw err
  }
}
