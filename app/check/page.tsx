'use client'

import { FormEvent, useState } from 'react'
import { ContentPage } from '@/components/content-page'
import { CTA } from '@/components/marketing'

const stages = ['Preparing your audit...', 'Generating buyer-intent queries...', 'Checking search visibility...', 'Analyzing AI-powered search data...', 'Comparing competitors...', 'Calculating your visibility...', 'Preparing your results...']

export default function Check() {
  const [form, setForm] = useState({ businessName: '', website: '', location: '', country: '', category: '', mainService: '', email: '' })
  const [state, setState] = useState<'idle' | 'processing' | 'failed'>('idle')
  const [stage, setStage] = useState(0)
  const [error, setError] = useState('')
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState('processing'); setError(''); setStage(0)
    const interval = window.setInterval(() => setStage((current) => Math.min(current + 1, stages.length - 1)), 1800)
    try {
      const response = await fetch('/api/audits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await response.json(); window.clearInterval(interval)
      if (!response.ok) throw new Error(data.error || 'The audit could not be completed.')
      window.location.assign(`/results/${data.auditId}?token=${encodeURIComponent(data.accessToken)}`)
    } catch (submissionError) { window.clearInterval(interval); setState('failed'); setError(submissionError instanceof Error ? submissionError.message : 'The audit could not be completed.') }
  }

  return <ContentPage eyebrow="Free initial audit" title="Find out if buyers can find your business." intro="Enter your business details to run a real search visibility audit. No credit card required.">
    <form onSubmit={handleSubmit} className="max-w-xl rounded-3xl border border-border bg-card p-6">
      {([['businessName', 'Business name', 'Acme Dental'], ['website', 'Website URL', 'yourbusiness.com'], ['location', 'City or region', 'Austin'], ['country', 'Country', 'United States'], ['category', 'Business category', 'Dental clinic']] as const).map(([key, label, placeholder]) => <label key={key} htmlFor={key} className="mt-4 block first:mt-0 text-sm font-semibold">{label}<input id={key} required value={form[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} disabled={state === 'processing'} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 font-normal outline-none ring-accent focus:ring-2 disabled:opacity-60" /></label>)}
      <label htmlFor="mainService" className="mt-4 block text-sm font-semibold">Main service <span className="font-normal text-muted-foreground">(optional)</span><input id="mainService" value={form.mainService} onChange={(event) => update('mainService', event.target.value)} placeholder="Emergency root canals" disabled={state === 'processing'} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 font-normal outline-none ring-accent focus:ring-2 disabled:opacity-60" /></label>
      <label htmlFor="email" className="mt-4 block text-sm font-semibold">Email for your results <span className="font-normal text-muted-foreground">(optional)</span><input id="email" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="you@company.com" disabled={state === 'processing'} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 font-normal outline-none ring-accent focus:ring-2 disabled:opacity-60" /></label>
      <button className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={state === 'processing'}>{state === 'processing' ? 'Running your real audit...' : 'Check My AI Visibility — Free'}</button>
      {state === 'processing' && <div aria-live="polite" className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">{stages[stage]}</div>}
      {state === 'failed' && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    </form>
    <div className="mt-8"><CTA href="/buy" variant="secondary">Prefer the full report? Get it for $19</CTA></div>
  </ContentPage>
}
