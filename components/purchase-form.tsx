'use client'

import { useState } from 'react'

export function PurchaseForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(event.currentTarget)
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
    window.location.assign(result.checkoutUrl)
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="businessName" required placeholder="Business name" className="rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/55 focus:border-accent" />
        <input name="websiteUrl" required type="url" placeholder="https://yourwebsite.com" className="rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/55 focus:border-accent" />
        <input name="location" required placeholder="City or region" className="rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/55 focus:border-accent" />
        <input name="country" required placeholder="Country" className="rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/55 focus:border-accent" />
        <input name="category" required placeholder="Business category" className="rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/55 focus:border-accent" />
        <input name="email" required type="email" placeholder="Report delivery email" className="rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/55 focus:border-accent" />
      </div>
      {error ? <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-primary-foreground">{error}</p> : null}
      <button type="submit" disabled={loading} className="w-full rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
        {loading ? 'Preparing secure checkout…' : 'Continue to secure checkout'}
      </button>
    </form>
  )
}
