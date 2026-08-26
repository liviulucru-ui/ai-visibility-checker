'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { ContentPage } from '@/components/content-page'
import { CTA } from '@/components/marketing'

type SearchResult = { title?: string; link?: string; snippet?: string }
type FindingQuery = { query: string; results: SearchResult[]; unavailable?: boolean }
type Interpretation = {
  visibility_score: number;
  summary: string;
  brand_presence: "High" | "Medium" | "Low" | "Not Found";
  top_competitors: Array<{ name: string; domain: string; strengths: string }>;
  ai_readiness_breakdown: { chatgpt_visibility: string; perplexity_search_rank: string; google_gemini_presence: string };
  actionable_recommendations: Array<{ priority: "High" | "Medium"; action: string; impact: string }>;
}
type Audit = { gumroad_sale_id?: string | null; status: string; score: number | null; findings?: { queries_analyzed?: number; query_results?: FindingQuery[]; raw_search_evidence?: FindingQuery[]; note?: string; ai_interpretation?: Interpretation | null; ai_interpretation_status?: 'available' | 'unavailable'; deterministic_score_inputs?: { valid_queries: number; mentions_weight: number; top_result_weight: number; citations_weight: number } } }

export default function ResultsPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const [audit, setAudit] = useState<Audit | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    let active = true
    let timer: number | undefined
    const poll = async () => {
      try {
        const fetchUrl = token ? `/api/audits?id=${encodeURIComponent(params.id)}&token=${encodeURIComponent(token)}` : `/api/audits?id=${encodeURIComponent(params.id)}`
        const response = await fetch(fetchUrl, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Results are unavailable.')
        if (!active) return
        setAudit(data)
        if (data.status === 'processing' || data.status === 'queued') timer = window.setTimeout(poll, 2000)
      } catch (pollError) { if (active) setError(pollError instanceof Error ? pollError.message : 'Results are unavailable.') }
    }
    poll()
    return () => { active = false; if (timer) window.clearTimeout(timer) }
  }, [params.id, searchParams])

  if (error) return <ContentPage eyebrow="Audit failed" title="We could not load this audit." intro={error}><CTA href="/check">Try another audit</CTA></ContentPage>
  if (!audit || audit.status === 'processing' || audit.status === 'queued') return <ContentPage eyebrow="Audit in progress" title="Preparing your audit..." intro="Generating relevant searches, checking search visibility, analyzing competitors, and preparing your results. This page will update automatically." />
  if (audit.status === 'failed') return <ContentPage eyebrow="Audit failed" title="The audit could not be completed." intro="No results were generated. Check the configuration and try again."><CTA href="/check">Try another audit</CTA></ContentPage>

  const isPaid = Boolean(audit.gumroad_sale_id)
  const findings = audit.findings
  const interpretation = findings?.ai_interpretation
  const scoreInputs = findings?.deterministic_score_inputs

  if (!interpretation) {
    return <ContentPage eyebrow="Real audit results" title="Here is what surfaced for your business." intro="These findings are based on real search evidence returned by the audit provider—not illustrative data.">
      <div className="max-w-3xl space-y-5">
        <div className="rounded-3xl border border-border bg-card p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Deterministic visibility score</p><p className="mt-2 font-mono text-5xl font-semibold">{audit.score ?? '—'}<span className="text-2xl text-muted-foreground">/100</span></p></div><p className="max-w-xs text-right text-sm text-muted-foreground">Calculated only from the real evidence below.</p></div>{scoreInputs && <p className="mt-4 text-xs text-muted-foreground">{scoreInputs.valid_queries} queries with organic results; mention 55%, top result 25%, owned-domain citation 20%.</p>}{findings?.note && <p className="mt-3 text-sm text-muted-foreground">{findings.note}</p>}</div>
        <section className="rounded-3xl border border-border bg-card p-6"><p className="font-semibold">AI interpretation unavailable</p><p className="mt-2 text-sm leading-6 text-muted-foreground">The real search evidence and deterministic score are preserved. No AI conclusions were generated.</p></section>
      </div>
    </ContentPage>
  }

  const scoreColor = interpretation.visibility_score >= 80 ? 'text-green-500' : interpretation.visibility_score >= 50 ? 'text-yellow-500' : 'text-red-500'
  const presenceColors: Record<string, string> = { "High": "bg-green-500/20 text-green-600", "Medium": "bg-yellow-500/20 text-yellow-600", "Low": "bg-red-500/20 text-red-600", "Not Found": "bg-gray-500/20 text-gray-500" }

  return <ContentPage eyebrow="AI Audit Report" title="Here is your visibility breakdown." intro="Powered by Gemini 1.5 Flash analysis of raw search signals.">
    <div className="max-w-3xl space-y-5">
      <div className="rounded-3xl border border-violet-400/40 bg-violet-500/10 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-violet-400 uppercase tracking-widest font-semibold">AI Visibility Score</p>
            <p className={`mt-2 font-mono text-5xl font-semibold ${scoreColor}`}>{interpretation.visibility_score}<span className="text-2xl text-violet-400/50">/100</span></p>
          </div>
          <div className="text-right">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${presenceColors[interpretation.brand_presence] || presenceColors["Not Found"]}`}>
              Presence: {interpretation.brand_presence}
            </span>
          </div>
        </div>
        <p className="mt-6 leading-7 text-sm">{interpretation.summary}</p>
      </div>

      <section className="rounded-3xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-4">Top Competitors</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {interpretation.top_competitors.slice(0, 2).map(comp => (
            <div key={comp.domain} className="p-4 rounded-2xl bg-muted/50">
              <p className="font-semibold text-sm">{comp.name}</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{comp.domain}</p>
              <p className="mt-2 text-xs leading-5">{comp.strengths}</p>
            </div>
          ))}
          {interpretation.top_competitors.length === 0 && <p className="text-sm text-muted-foreground">No prominent competitors identified in top results.</p>}
        </div>
      </section>

      {!isPaid ? (
        <div className="relative mt-8 overflow-hidden rounded-3xl border border-border bg-card p-8 text-center">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/90 z-10 pointer-events-none" />
          <h3 className="font-semibold relative z-20 text-xl">Unlock the Full Action Plan</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto relative z-20">Get the complete AI Readiness Breakdown (ChatGPT & Perplexity metrics) and a step-by-step checklist of actionable recommendations to dominate your niche.</p>
          <div className="mt-6 relative z-20 flex justify-center">
            <CTA href="/buy">Unlock Full $19 Audit</CTA>
          </div>

          <div className="opacity-20 mt-8 space-y-4 blur-[2px]">
            <div className="h-24 bg-muted rounded-xl w-full" />
            <div className="h-32 bg-muted rounded-xl w-full" />
          </div>
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">AI Search Readiness</h3>
            <div className="space-y-4 divide-y divide-border">
              <div className="pt-4 first:pt-0"><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">ChatGPT Visibility</p><p className="text-sm">{interpretation.ai_readiness_breakdown.chatgpt_visibility}</p></div>
              <div className="pt-4"><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Perplexity Rank</p><p className="text-sm">{interpretation.ai_readiness_breakdown.perplexity_search_rank}</p></div>
              <div className="pt-4"><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Google Gemini Presence</p><p className="text-sm">{interpretation.ai_readiness_breakdown.google_gemini_presence}</p></div>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Actionable Recommendations</h3>
            {interpretation.actionable_recommendations.length > 0 ? (
              <div className="space-y-4">
                {interpretation.actionable_recommendations.map((rec, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl bg-muted/30 border border-muted">
                    <div className="shrink-0 mt-0.5">
                      <span className={`inline-block px-2 py-0.5 text-[10px] uppercase font-bold rounded ${rec.priority === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {rec.priority}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{rec.action}</p>
                      <p className="text-xs text-muted-foreground mt-1">Impact: {rec.impact}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No actions recommended at this time.</p>
            )}
          </section>
        </>
      )}
    </div>
  </ContentPage>
}
