'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { ContentPage } from '@/components/content-page'
import { CTA } from '@/components/marketing'

type SearchResult = { title?: string; link?: string; snippet?: string }
type FindingQuery = { query: string; results: SearchResult[]; unavailable?: boolean }
type Interpretation = {
  visibility_score: number;
  presence_level?: "High" | "Medium" | "Low" | "Not Found" | "Absent" | "Weak" | "Moderate";
  executive_summary?: string;
  executive_roi_summary?: string;
  summary?: string;
  brand_presence?: "High" | "Medium" | "Low" | "Not Found";
  top_competitors?: Array<{ name: string; domain: string; strengths: string }>;
  commercial_queries_simulation?: Array<{ query: string; why_competitors_win: string }>;
  ai_readiness_breakdown?: { chatgpt_visibility: string; perplexity_search_rank: string; google_gemini_presence: string };
  actionable_recommendations?: Array<{ priority: "High" | "Medium"; action: string; impact: string }>;
  engine_readiness?: {
    chatgpt_search: { score: number; status: string; analysis: string };
    perplexity_ai: { score: number; status: string; analysis: string };
    google_ai_overview: { score: number; status: string; analysis: string };
  };
  in_depth_competitors?: Array<{ name: string; domain: string; visibility_score: number; why_ai_recommends_them: string; content_gaps: string }>;
  technical_ai_signals?: { schema_markup: string; entity_disambiguation: string; sentiment_and_mentions: string };
  ready_to_use_schema?: string;
  action_plan_30_days?: Array<{ day_range: string; priority: "High" | "Medium" | "Low"; action: string; description: string }>;
}
type Audit = { is_paid?: boolean | null; gumroad_sale_id?: string | null; payment_verified_at?: string | null; status: string; score: number | null; findings?: { queries_analyzed?: number; query_results?: FindingQuery[]; raw_search_evidence?: FindingQuery[]; note?: string; ai_interpretation?: Interpretation | null; ai_interpretation_status?: 'available' | 'unavailable'; deterministic_score_inputs?: { valid_queries: number; mentions_weight: number; top_result_weight: number; citations_weight: number } } }

export default function ResultsPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const [audit, setAudit] = useState<Audit | null>(null)
  const [error, setError] = useState('')


  useEffect(() => {
    const token = searchParams.get('token')
    const paidParam = searchParams.get('paid') === 'true'
    let active = true
    let timer: number | undefined

    // Proactively notify backend if we returned from Gumroad
    if (paidParam && params.id) {
      fetch('/api/gumroad/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId: params.id })
      }).catch(console.error)
    }

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


  const isPaid = Boolean(audit?.is_paid || audit?.gumroad_sale_id || audit?.payment_verified_at || audit?.status === 'payment_verified' || searchParams.get('paid') === 'true')
  const isUpgrading = false

  if (error) return <ContentPage eyebrow="Audit failed" title="We could not load this audit." intro={error}><CTA href="/check">Try another audit</CTA></ContentPage>
  if (!audit || audit.status === 'processing' || audit.status === 'queued' || isUpgrading) return <ContentPage eyebrow="Audit in progress" title={isUpgrading ? "Upgrading to deep audit..." : "Preparing your audit..."} intro="Generating relevant searches, checking search visibility, analyzing competitors, and preparing your results. This page will update automatically." />
  if (audit.status === 'failed') return <ContentPage eyebrow="Audit failed" title="The audit could not be completed." intro="No results were generated. Check the configuration and try again."><CTA href="/check">Try another audit</CTA></ContentPage>

  const findings = audit.findings

  const interpretation = findings?.ai_interpretation as Interpretation | null | undefined
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
  const presenceColors: Record<string, string> = { "High": "bg-green-500/20 text-green-600", "Medium": "bg-yellow-500/20 text-yellow-600", "Low": "bg-red-500/20 text-red-600", "Not Found": "bg-gray-500/20 text-gray-500", "Absent": "bg-gray-500/20 text-gray-500", "Weak": "bg-red-500/20 text-red-600", "Moderate": "bg-yellow-500/20 text-yellow-600" }

  const brandPresence = interpretation.brand_presence || interpretation.presence_level || "Not Found"
  const execSummary = interpretation.executive_summary || interpretation.summary || ""
  const engineBreakdown = interpretation.engine_readiness || (interpretation.ai_readiness_breakdown ? {
    chatgpt_search: { score: 0, status: interpretation.ai_readiness_breakdown.chatgpt_visibility, analysis: '' },
    perplexity_ai: { score: 0, status: interpretation.ai_readiness_breakdown.perplexity_search_rank, analysis: '' },
    google_ai_overview: { score: 0, status: interpretation.ai_readiness_breakdown.google_gemini_presence, analysis: '' },
  } : null)

  const competitors = interpretation.in_depth_competitors || (interpretation.top_competitors ? interpretation.top_competitors.map(c => ({
    name: c.name, domain: c.domain, visibility_score: 0, why_ai_recommends_them: c.strengths, content_gaps: ''
  })) : [])

  const actionPlan = interpretation.action_plan_30_days || (interpretation.actionable_recommendations ? interpretation.actionable_recommendations.map(r => ({
    day_range: 'Ongoing', priority: r.priority, action: r.action, description: r.impact
  })) : [])

  return <ContentPage eyebrow="AI Audit Report" title="Here is your visibility breakdown." intro="Powered by Multi-Engine AI Brand Intelligence.">
    <div className="max-w-3xl space-y-5">
      <div className="rounded-3xl border border-violet-400/40 bg-violet-500/10 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-violet-400 uppercase tracking-widest font-semibold">AI Visibility Score</p>
            <p className={`mt-2 font-mono text-5xl font-semibold ${scoreColor}`}>{interpretation.visibility_score}<span className="text-2xl text-violet-400/50">/100</span></p>
          </div>
          <div className="text-right">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${presenceColors[brandPresence] || presenceColors["Not Found"]}`}>
              Presence: {brandPresence}
            </span>
          </div>
        </div>
        <p className="mt-6 leading-7 text-sm">{execSummary}</p>
      </div>

      <section className="rounded-3xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-4">Competitor Intelligence</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {competitors.slice(0, isPaid ? competitors.length : 2).map(comp => (
            <div key={comp.domain} className="p-4 rounded-2xl bg-muted/50">
              <div className="flex justify-between items-start">
                <p className="font-semibold text-sm">{comp.name}</p>
                {isPaid && comp.visibility_score > 0 && <span className="text-xs font-mono bg-background px-2 py-0.5 rounded">{comp.visibility_score}/100</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{comp.domain}</p>
              <p className="mt-3 text-xs leading-5"><span className="font-medium text-foreground">Why AI Recommends Them:</span> {comp.why_ai_recommends_them}</p>
              {isPaid && comp.content_gaps && <p className="mt-2 text-xs leading-5"><span className="font-medium text-foreground">Content Gaps:</span> {comp.content_gaps}</p>}
            </div>
          ))}
          {competitors.length === 0 && <p className="text-sm text-muted-foreground">No prominent competitors identified in top results.</p>}
        </div>
      </section>

      {!isPaid ? (
        <div className="relative mt-8 overflow-hidden rounded-3xl border border-border bg-card p-8 text-center">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/90 z-10 pointer-events-none" />
          <h3 className="font-semibold relative z-20 text-xl">Unlock the Full Action Plan</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto relative z-20">Get the complete AI Readiness Breakdown (ChatGPT & Perplexity metrics) and a step-by-step checklist of actionable recommendations to dominate your niche.</p>
          <div className="mt-6 relative z-20 flex justify-center" onClick={() => { if (typeof window !== 'undefined' && params.id) localStorage.setItem('last_audit_id', String(params.id)) }}>
            <CTA href={`/buy?auditId=${params.id}`}>Get Full Report — $19 →</CTA>
          </div>

          <div className="opacity-20 mt-8 space-y-4 blur-[2px]">
            <div className="h-24 bg-muted rounded-xl w-full" />
            <div className="h-32 bg-muted rounded-xl w-full" />
          </div>
        </div>
      ) : (
        <>

          {interpretation.executive_roi_summary && (
            <section className="rounded-3xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">Executive ROI Summary</h3>
              <p className="text-sm leading-7 text-muted-foreground">{interpretation.executive_roi_summary}</p>
            </section>
          )}

          {interpretation.commercial_queries_simulation && interpretation.commercial_queries_simulation.length > 0 && (
            <section className="rounded-3xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">Commercial Queries Simulation</h3>
              <div className="space-y-4">
                {interpretation.commercial_queries_simulation.map((sim, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-muted/30 border border-muted">
                    <p className="font-mono text-sm font-semibold mb-2">"{sim.query}"</p>
                    <p className="text-sm text-muted-foreground leading-6"><span className="font-medium text-foreground">Why Competitors Win:</span> {sim.why_competitors_win}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {engineBreakdown && (
            <section className="rounded-3xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">Engine Breakdown Grid</h3>
              <div className="space-y-6 divide-y divide-border">
                <div className="pt-4 first:pt-0">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">ChatGPT Search</p>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${presenceColors[engineBreakdown.chatgpt_search.status] || presenceColors["Not Found"]}`}>{engineBreakdown.chatgpt_search.status}</span>
                  </div>
                  <p className="text-sm leading-6">{engineBreakdown.chatgpt_search.analysis}</p>
                </div>
                <div className="pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Perplexity AI</p>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${presenceColors[engineBreakdown.perplexity_ai.status] || presenceColors["Not Found"]}`}>{engineBreakdown.perplexity_ai.status}</span>
                  </div>
                  <p className="text-sm leading-6">{engineBreakdown.perplexity_ai.analysis}</p>
                </div>
                <div className="pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Google AI Overviews</p>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${presenceColors[engineBreakdown.google_ai_overview.status] || presenceColors["Not Found"]}`}>{engineBreakdown.google_ai_overview.status}</span>
                  </div>
                  <p className="text-sm leading-6">{engineBreakdown.google_ai_overview.analysis}</p>
                </div>
              </div>
            </section>
          )}

          {interpretation.technical_ai_signals && (
            <section className="rounded-3xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">Technical AI Signals</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Schema Markup</p>
                  <p className="text-sm leading-6">{interpretation.technical_ai_signals.schema_markup}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Entity Disambiguation</p>
                  <p className="text-sm leading-6">{interpretation.technical_ai_signals.entity_disambiguation}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Sentiment & Mentions</p>
                  <p className="text-sm leading-6">{interpretation.technical_ai_signals.sentiment_and_mentions}</p>
                </div>
              </div>
            </section>
          )}


          {interpretation.ready_to_use_schema && (
            <section className="rounded-3xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">Ready-to-Use Schema Markup</h3>
              <p className="text-xs text-muted-foreground mb-4">Inject this JSON-LD script into your website's &lt;head&gt; to improve entity recognition.</p>
              <pre className="p-4 rounded-xl bg-primary text-primary-foreground text-xs overflow-x-auto font-mono whitespace-pre-wrap">
                {interpretation.ready_to_use_schema}
              </pre>
            </section>
          )}

          <section className="rounded-3xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">30-Day Implementation Checklist</h3>
            {actionPlan.length > 0 ? (
              <div className="space-y-4">
                {actionPlan.map((rec, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl bg-muted/30 border border-muted">
                    <div className="shrink-0 mt-0.5 w-20">
                      <p className="text-xs font-semibold text-muted-foreground">{rec.day_range}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] uppercase font-bold rounded ${rec.priority === 'High' ? 'bg-red-500/20 text-red-400' : rec.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {rec.priority}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{rec.action}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-5">{rec.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No actions recommended at this time.</p>
            )}
          </section>

          <div className="mt-8 flex justify-center print-hide gap-4">
            <button
              onClick={() => window.print()}
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:-translate-y-0.5 transition-transform"
            >
              Download PDF Report
            </button>
          </div>
        </>
      )}
    </div>
  </ContentPage>
}
