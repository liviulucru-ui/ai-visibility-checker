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
  brand_presence?: "High" | "Medium" | "Low" | "Not Found" | "Strong" | "Missing";
  top_competitors?: Array<{ name: string; domain: string; strengths?: string; winning_search?: string; advantage?: string; }>;
  commercial_queries_simulation?: Array<{ query: string; why_competitors_win: string }>;
  ai_readiness_breakdown?: { chatgpt_visibility: string; perplexity_search_rank: string; google_gemini_presence: string };
  actionable_recommendations?: Array<{ priority: "High" | "Medium"; action: string; impact: string }>;
  engine_readiness?: {
    chatgpt_search: { score: number; status: string; analysis: string };
    perplexity_ai: { score: number; status: string; analysis: string };
    google_ai_overview: { score: number; status: string; analysis: string };
  };
  in_depth_competitors?: Array<{ name: string; domain: string; visibility_score: number; why_ai_recommends_them?: string; content_gaps?: string; winning_queries?: string[]; strongest_sources?: string[]; advantage_summary?: string }>;
  technical_ai_signals?: { schema_markup: string; entity_disambiguation: string; sentiment_and_mentions: string };
  technical_signals?: Array<{ label: string; status: "Good" | "Needs Work" | "Missing"; explanation: string }>;
  ready_to_use_schema?: string;
  action_plan_30_days?: Array<{ day_range?: string; priority: "High" | "Medium" | "Low"; action: string; description?: string }>;
  action_tasks?: Array<{ timeframe: string; priority: "High" | "Medium" | "Low"; action: string; target_location?: string; why: string; expected_impact: string }>;
  engine_snapshot?: { chatgpt: { status: string; reason: string }; gemini: { status: string; reason: string }; perplexity: { status: string; reason: string }; google_ai: { status: string; reason: string } };
  sample_evidence?: Array<{ query: string; competitor_win: string; status: string }>;
  competitor_insights?: Array<{ name: string; domain: string; winning_queries: string[]; strongest_sources?: string[]; advantage_summary: string }>;
  score_breakdown?: { brand_presence: number; buyer_search_visibility: number; source_authority: number };
  engine_visibility?: Array<{ engine: string; status: string; queries_checked: number; brand_wins: number; competitor_wins: number; strongest_competitor?: string; summary: string; top_issue?: string }>;
  evidence_items?: Array<{ query: string; intent?: string; engine: string; your_status: string; winning_competitor?: string; source?: string }>;
}
type Audit = { is_paid?: boolean | null; gumroad_sale_id?: string | null; payment_verified_at?: string | null; status: string; score: number | null; created_at?: string | null; findings?: { country?: string; queries_analyzed?: number; query_results?: FindingQuery[]; raw_search_evidence?: FindingQuery[]; note?: string; ai_interpretation?: Interpretation | null; ai_interpretation_status?: 'available' | 'unavailable'; deterministic_score_inputs?: { valid_queries: number; mentions_weight: number; top_result_weight: number; citations_weight: number } } }
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

const competitors = interpretation.competitor_insights || interpretation.in_depth_competitors || interpretation.top_competitors || []

const actionPlan = interpretation.action_tasks || interpretation.action_plan_30_days || (interpretation.actionable_recommendations ? interpretation.actionable_recommendations.map(r => ({
    day_range: 'Ongoing', priority: r.priority, action: r.action, description: r.impact
  })) : [])


  const engineSnapshot = interpretation.engine_snapshot || {
    chatgpt: { status: 'Missing', reason: '' },
    gemini: { status: 'Missing', reason: '' },
    perplexity: { status: 'Missing', reason: '' },
    google_ai: { status: 'Missing', reason: '' }
  }
  const evidenceItems = interpretation.evidence_items || interpretation.sample_evidence || []

  return <ContentPage eyebrow="AI Audit Report" title="Here is your visibility breakdown." intro="Powered by Multi-Engine AI Brand Intelligence.">
    <div className="max-w-4xl space-y-6">

      {/* Scan Coverage Strip */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-muted/40 px-6 py-4 text-xs text-muted-foreground font-mono">
        <span className="font-semibold text-foreground">Scan Coverage:</span>
        <span>{findings?.queries_analyzed || evidenceItems.length} buyer searches checked</span>
        <span>&middot;</span>
        <span>4 AI engines evaluated</span>
        {findings?.country && <><span>&middot;</span><span>{findings.country}</span></>}
        <span>&middot;</span>
        <span>Completed {new Date(audit.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Score Card */}
        <div className="rounded-3xl border border-violet-400/40 bg-violet-500/10 p-6 md:col-span-1 flex flex-col justify-center">
          <p className="text-xs text-violet-500 uppercase tracking-widest font-semibold mb-2">AI Visibility Score</p>
          <p className={`font-mono text-6xl font-bold ${scoreColor}`}>{interpretation.visibility_score}<span className="text-2xl text-violet-400/50">/100</span></p>
          <div className="mt-4">
            <span className={`inline-block px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${presenceColors[brandPresence] || presenceColors["Not Found"]}`}>
              Presence: {brandPresence}
            </span>
          </div>
        </div>

        {/* Free Summary / Paid Score Breakdown */}
        <div className="rounded-3xl border border-border bg-card p-6 md:col-span-2">
          {!isPaid ? (
            <>
              <h3 className="font-semibold text-lg mb-3">Diagnostic Summary</h3>
              <p className="text-sm leading-7 text-muted-foreground">{execSummary}</p>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-lg mb-4">Score Breakdown</h3>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1"><span>Brand Presence</span><span className="font-mono">{interpretation.score_breakdown?.brand_presence ?? 0}%</span></div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${interpretation.score_breakdown?.brand_presence ?? 0}%` }}></div></div>
                  <p className="text-[10px] text-muted-foreground mt-1">How clearly AI/search systems identify the brand.</p>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1"><span>Buyer Search Visibility</span><span className="font-mono">{interpretation.score_breakdown?.buyer_search_visibility ?? 0}%</span></div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-accent" style={{ width: `${interpretation.score_breakdown?.buyer_search_visibility ?? 0}%` }}></div></div>
                  <p className="text-[10px] text-muted-foreground mt-1">How often the brand appears for commercial-intent searches.</p>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1"><span>Source Authority Signals</span><span className="font-mono">{interpretation.score_breakdown?.source_authority ?? 0}%</span></div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-violet-500" style={{ width: `${interpretation.score_breakdown?.source_authority ?? 0}%` }}></div></div>
                  <p className="text-[10px] text-muted-foreground mt-1">Strength of supporting sources, listings, and structured signals.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {isPaid && interpretation.executive_roi_summary && (
        <section className="rounded-3xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4 text-lg">Executive Summary</h3>
          <p className="text-sm leading-7 text-muted-foreground whitespace-pre-wrap">{interpretation.executive_roi_summary || execSummary}</p>
        </section>
      )}

      {/* Engine Visibility Grid */}
      <section>
        <h3 className="font-semibold text-lg mb-4 ml-2">AI Engine Visibility</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {['ChatGPT', 'Gemini', 'Perplexity', 'Google AI'].map((engine) => {
            const eKey = engine.toLowerCase().replace(' ', '_') as 'chatgpt' | 'gemini' | 'perplexity' | 'google_ai'

            let status = 'Missing'
            let contentStr = ''

            if (isPaid && interpretation.engine_visibility) {
              const engData = interpretation.engine_visibility.find(e => e.engine === engine)
              status = engData?.status || 'Missing'
              contentStr = engData?.summary || ''
            } else {
              const engData = engineSnapshot[eKey]
              status = engData?.status || 'Missing'
              contentStr = engData?.reason || ''
            }

            const colorClass = status === 'Strong' ? 'bg-green-500/10 text-green-600 border-green-500/20' : status === 'Moderate' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' : status === 'Low' ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'

            return (
              <div key={engine} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex justify-between items-center mb-3">
                  <p className="font-bold">{engine}</p>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${colorClass}`}>{status}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-6">{contentStr || `Evaluating source visibility and citation probability across ${engine}.`}</p>
                {!isPaid && <p className="text-[10px] font-mono text-muted-foreground/60 mt-4 uppercase tracking-widest">Inferred Signals</p>}
              </div>
            )
          })}
        </div>
      </section>

      {/* Buyer Search Evidence */}
      <section className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg">Searches That Decide Who Gets Recommended</h3>
          <p className="text-sm text-muted-foreground mt-1">Sample of high-intent buyer searches analyzed.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-semibold">Buyer Search</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Competitor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(evidenceItems).map((ev: any, i: number) => {
                const isWin = ev.status === 'You Appear' || ev.your_status === 'Found'
                const isLoss = ev.status === 'Competitor Wins' || ev.your_status === 'Competitor Wins' || ev.your_status === 'Missing'
                return (
                  <tr key={i} className="bg-card">
                    <td className="px-6 py-4 font-medium max-w-[250px] truncate" title={ev.query}>"{ev.query}"</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isWin ? 'bg-green-500/10 text-green-600' : isLoss ? 'bg-red-500/10 text-red-600' : 'bg-yellow-500/10 text-yellow-600'}`}>
                        {ev.your_status || ev.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground truncate max-w-[200px]">{ev.winning_competitor || ev.competitor_win || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-4 text-lg">Competitor Intelligence</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {competitors.slice(0, isPaid ? competitors.length : 2).map((comp: any) => (
            <div key={comp.domain} className="p-5 rounded-2xl bg-muted/40 border border-border/50">
              <div className="flex justify-between items-start">
                <p className="font-bold">{comp.name}</p>
                {isPaid && comp.visibility_score > 0 && <span className="text-[10px] font-mono font-bold bg-background border px-2 py-0.5 rounded">{comp.visibility_score}/100</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono mb-4">{comp.domain}</p>

              {isPaid && comp.winning_queries && comp.winning_queries.length > 0 && (
                <div className="mb-3">
                   <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Winning Searches</p>
                   <ul className="text-xs space-y-1">{comp.winning_queries.slice(0,2).map((q: string) => <li key={q} className="truncate">"{q}"</li>)}</ul>
                </div>
              )}

              <p className="text-xs leading-5"><span className="font-semibold text-foreground">AI Advantage:</span> {comp.advantage_summary || comp.advantage || comp.why_ai_recommends_them}</p>
            </div>
          ))}
          {competitors.length === 0 && <p className="text-sm text-muted-foreground">No prominent competitors identified in top results.</p>}
        </div>
      </section>

      {!isPaid ? (
        <div className="relative mt-12 overflow-hidden rounded-[2rem] border border-primary/20 bg-primary/5 p-8 text-center sm:p-12">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/50 z-10 pointer-events-none" />
          <h3 className="font-semibold relative z-20 text-2xl tracking-tight">Your full AI visibility gap is ready</h3>
          <p className="text-sm text-muted-foreground mt-3 max-w-lg mx-auto relative z-20 leading-relaxed">See every buyer search we analyzed, which competitors are winning, your true visibility across AI engines, and the exact actions that can improve your presence.</p>
          <div className="mt-8 relative z-20 flex flex-col items-center justify-center gap-3" onClick={() => { if (typeof window !== 'undefined' && params.id) localStorage.setItem('last_audit_id', String(params.id)) }}>
            <CTA href={`/buy?auditId=${params.id}`}>Unlock Full AI Visibility Report — $19</CTA>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">One-time payment. Instant access.</span>
          </div>

          <div className="opacity-20 mt-12 space-y-6 blur-[3px] select-none pointer-events-none">
            <div className="h-32 bg-muted rounded-2xl w-full border border-border" />
            <div className="h-48 bg-muted rounded-2xl w-full border border-border" />
          </div>
        </div>
      ) : (
        <>
          {interpretation.commercial_queries_simulation && interpretation.commercial_queries_simulation.length > 0 && (
            <section className="rounded-3xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4 text-lg">Commercial Queries Simulation</h3>
              <div className="space-y-4">
                {interpretation.commercial_queries_simulation.map((sim: any, i: number) => (
                  <div key={i} className="p-4 rounded-2xl bg-muted/30 border border-muted">
                    <p className="font-mono text-sm font-semibold mb-2">"{sim.query}"</p>
                    <p className="text-sm text-muted-foreground leading-6"><span className="font-medium text-foreground">Why Competitors Win:</span> {sim.why_competitors_win}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {interpretation.technical_signals && interpretation.technical_signals.length > 0 && (
            <section className="rounded-3xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4 text-lg">Technical Visibility Signals</h3>
              <div className="space-y-4">
                {interpretation.technical_signals.map((sig: any, i: number) => {
                  const color = sig.status === 'Good' ? 'text-green-600 bg-green-500/10' : sig.status === 'Missing' ? 'text-red-600 bg-red-500/10' : 'text-yellow-600 bg-yellow-500/10'
                  return (
                    <div key={i}>
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${color}`}>{sig.status}</span>
                        <p className="text-sm font-semibold">{sig.label}</p>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{sig.explanation}</p>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {interpretation.ready_to_use_schema && (
            <section className="rounded-3xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4 text-lg">Ready-to-Use Schema Markup</h3>
              <p className="text-xs text-muted-foreground mb-4">Inject this JSON-LD script into your website's &lt;head&gt; to improve entity recognition across AI search systems.</p>
              <pre className="p-4 rounded-xl bg-primary text-primary-foreground text-xs overflow-x-auto font-mono whitespace-pre-wrap">
                {interpretation.ready_to_use_schema}
              </pre>
            </section>
          )}

          <section className="rounded-3xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4 text-lg">30-Day Implementation Checklist</h3>
            {actionPlan.length > 0 ? (
              <div className="space-y-4">
                {actionPlan.map((rec: any, i: number) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-4 p-5 rounded-2xl bg-muted/30 border border-muted">
                    <div className="shrink-0 sm:w-28 flex sm:flex-col gap-3 sm:gap-1 items-center sm:items-start">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{rec.timeframe || rec.day_range}</p>
                      <span className={`inline-block px-2 py-0.5 text-[10px] uppercase font-bold rounded ${rec.priority === 'High' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : rec.priority === 'Medium' ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20' : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'}`}>
                        {rec.priority}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{rec.action}</p>
                      {rec.target_location && <p className="text-[10px] font-mono text-muted-foreground mt-2">📍 {rec.target_location}</p>}
                      <p className="text-sm text-muted-foreground mt-2 leading-6"><span className="font-medium text-foreground">Why:</span> {rec.why || rec.description}</p>
                      {rec.expected_impact && <p className="text-sm text-muted-foreground mt-1 leading-6"><span className="font-medium text-foreground">Impact:</span> {rec.expected_impact}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No actions recommended at this time.</p>
            )}
          </section>

          <div className="mt-12 flex justify-center print-hide gap-4">
            <button
              onClick={() => window.print()}
              className="rounded-full bg-accent px-8 py-4 text-sm font-bold text-accent-foreground hover:-translate-y-0.5 transition-transform"
            >
              Download PDF Report
            </button>
          </div>
        </>
      )}
    </div>
  </ContentPage>
}
