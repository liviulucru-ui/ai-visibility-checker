'use client'

import { FormEvent, useState } from 'react'
import { ContentPage } from '@/components/content-page'
import { CTA } from '@/components/marketing'

const stages = ['Identifying your brand...', 'Understanding your category...', 'Generating buyer-intent searches...', 'Evaluating engine visibility evidence...', 'Detecting competitors...', 'Comparing AI engine presence...', 'Calculating your visibility score...', 'Preparing your report...']

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
      window.location.assign(`/results/${data.audit?.id || data.auditId}?token=${encodeURIComponent(data.accessToken)}`)
    } catch (submissionError) { window.clearInterval(interval); setState('failed'); setError(submissionError instanceof Error ? submissionError.message : 'The audit could not be completed.') }
  }

  return <ContentPage eyebrow="Free. No credit card required." title="Check how AI sees your brand." intro="Enter your business and see whether major AI discovery engines find you — or your competitors.">
    <form onSubmit={handleSubmit} className="max-w-xl rounded-3xl border border-border bg-card p-6">
      {([['businessName', 'Business name', 'Acme Dental'], ['website', 'Website URL', 'yourbusiness.com'], ['location', 'City or region', 'Austin'], ['country', 'Country', 'United States'], ['category', 'Business category', 'Dental clinic']] as const).map(([key, label, placeholder]) => <label key={key} htmlFor={key} className="mt-4 block first:mt-0 text-sm font-semibold">{label}<input id={key} required value={form[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} disabled={state === 'processing'} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 font-normal outline-none ring-accent focus:ring-2 disabled:opacity-60" /></label>)}
      <label htmlFor="mainService" className="mt-4 block text-sm font-semibold">Main service <span className="font-normal text-muted-foreground">(optional)</span><input id="mainService" value={form.mainService} onChange={(event) => update('mainService', event.target.value)} placeholder="Emergency root canals" disabled={state === 'processing'} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 font-normal outline-none ring-accent focus:ring-2 disabled:opacity-60" /></label>

      <button className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={state === 'processing'}>{state === 'processing' ? 'Running your real audit...' : 'Check My AI Visibility — Free'}</button>
      {state === 'processing' && <div aria-live="polite" className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">{stages[stage]}</div>}
      {state === 'failed' && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    </form>
    <p className="mt-6 text-sm text-muted-foreground text-center max-w-xl">Free initial audit • No credit card required (Full Deep Audit with 30-Day Plan available for $19 after free baseline check)</p>
  </ContentPage>
}
