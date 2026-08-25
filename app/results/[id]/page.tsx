'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { ContentPage } from '@/components/content-page'
import { CTA } from '@/components/marketing'

type SearchResult = { title?: string; link?: string; snippet?: string }
type FindingQuery = { query: string; results: SearchResult[]; unavailable?: boolean }
type Interpretation = { summary: string; key_findings: string[]; competitor_observations: string[]; brand_accuracy_observations: string[]; opportunities: string[]; prioritized_actions: string[] }
type Audit = { status: string; score: number | null; findings?: { queries_analyzed?: number; query_results?: FindingQuery[]; raw_search_evidence?: FindingQuery[]; note?: string; ai_interpretation?: Interpretation | null; ai_interpretation_status?: 'available' | 'unavailable'; deterministic_score_inputs?: { valid_queries: number; mentions_weight: number; top_result_weight: number; citations_weight: number } } }

export default function ResultsPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const [audit, setAudit] = useState<Audit | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) { setError('This result link is missing its private access token.'); return }
    let active = true
    let timer: number | undefined
    const poll = async () => {
      try {
        const response = await fetch(`/api/audits?id=${encodeURIComponent(params.id)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
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

  const findings = audit.findings
  const queries = findings?.raw_search_evidence ?? findings?.query_results ?? []
  const interpretation = findings?.ai_interpretation
  const scoreInputs = findings?.deterministic_score_inputs
  const list = (title: string, items: string[]) => <section className="rounded-3xl border border-border bg-card p-6"><h3 className="font-semibold">{title}</h3>{items.length ? <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">No supported observations were returned.</p>}</section>
  return <ContentPage eyebrow="Real audit results" title="Here is what surfaced for your business." intro="These findings are based on real search evidence returned by the audit provider—not illustrative data.">
    <div className="max-w-3xl space-y-5">
      <div className="rounded-3xl border border-border bg-card p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Deterministic visibility score</p><p className="mt-2 font-mono text-5xl font-semibold">{audit.score ?? '—'}<span className="text-2xl text-muted-foreground">/100</span></p></div><p className="max-w-xs text-right text-sm text-muted-foreground">Calculated only from the real evidence below.</p></div>{scoreInputs && <p className="mt-4 text-xs text-muted-foreground">{scoreInputs.valid_queries} queries with organic results; mention 55%, top result 25%, owned-domain citation 20%.</p>}{findings?.note && <p className="mt-3 text-sm text-muted-foreground">{findings.note}</p>}</div>
      {interpretation ? <section className="rounded-3xl border border-violet-400/40 bg-violet-500/10 p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">AI interpretation</p><p className="mt-3 leading-7">{interpretation.summary}</p><div className="mt-6 grid gap-4 sm:grid-cols-2">{list('Key findings', interpretation.key_findings)}{list('Competitor observations', interpretation.competitor_observations)}{list('Brand accuracy', interpretation.brand_accuracy_observations)}{list('Opportunities', interpretation.opportunities)}</div>{list('Prioritized actions', interpretation.prioritized_actions)}</section> : <section className="rounded-3xl border border-border bg-card p-6"><p className="font-semibold">AI interpretation unavailable</p><p className="mt-2 text-sm leading-6 text-muted-foreground">The real search evidence and deterministic score are preserved. No AI conclusions were generated.</p></section>}
      <section><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Real search evidence</p></section>
      {queries.map((item) => <div key={item.query} className="rounded-3xl border border-border bg-card p-6"><p className="text-sm text-muted-foreground">Observed query</p><p className="mt-2 font-mono font-semibold">{item.query}</p>{item.unavailable ? <p className="mt-4 text-sm text-muted-foreground">This provider query was unavailable.</p> : item.results.length ? <div className="mt-4 divide-y divide-border">{item.results.map((result, index) => <a key={`${result.link}-${index}`} href={result.link} target="_blank" rel="noreferrer" className="block py-4 first:pt-0 last:pb-0"><p className="font-semibold">{result.title || 'Untitled result'}</p><p className="mt-1 text-sm text-muted-foreground">{result.snippet || result.link}</p></a>)}</div> : <p className="mt-4 text-sm text-muted-foreground">The provider returned no organic results for this query.</p>}</div>)}
      <CTA href="/buy">Get the full report — $19</CTA>
    </div>
  </ContentPage>
}
