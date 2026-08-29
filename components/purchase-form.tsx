'use client'

import { useState } from 'react'

export function PurchaseForm({ auditId }: { auditId?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(event.currentTarget)

    if (auditId) {
        form.set('auditId', auditId)
    }

    const response = await fetch('/api/gumroad/pending', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.checkoutUrl) {
      setError(result.error ?? 'Unable to prepare checkout.')
      setLoading(false)
      return
    }
    if (result.auditId) {
      try { localStorage.setItem('pending_audit_id', result.auditId) } catch {}
    }
    window.location.assign(result.checkoutUrl)
  }

  if (!auditId) {
      return (
          <div className="mt-8 space-y-3">
              <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-primary-foreground">
                  Missing required audit ID. Please return to your audit report or create a new one to continue.
              </p>
              <button disabled className="w-full rounded-full bg-accent/50 px-6 py-3.5 text-sm font-semibold text-accent-foreground transition-transform cursor-not-allowed opacity-60">
                Continue to secure checkout
              </button>
          </div>
      )
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-3">
        <input name="email" required type="email" placeholder="Report delivery email" className="w-full rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/55 focus:border-accent" />
        {error ? <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-primary-foreground">{error}</p> : null}
        <button type="submit" disabled={loading} className="w-full rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
        {loading ? 'Preparing secure checkout…' : 'Continue to secure checkout'}
        </button>
    </form>
  )
}
