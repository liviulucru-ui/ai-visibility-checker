'use client'

import { useEffect, useState } from 'react'

export function PurchaseStatus({ auditId, saleId }: { auditId: string; saleId?: string }) {
  const [status, setStatus] = useState('verifying')
  const [error, setError] = useState('')
  const [showFallbackButton, setShowFallbackButton] = useState(false)
  const localAuditId = auditId || (typeof window !== 'undefined' ? localStorage.getItem('last_audit_id') || localStorage.getItem('pending_audit_id') || '' : '')

  useEffect(() => {
    let active = true
    const timeoutTimer = setTimeout(() => {
      if (active) setShowFallbackButton(true)
    }, 8000)

    let retries = 0

    // First, proactively verify the session server-side to prevent webhook race conditions
    const verifySession = async () => {
      if (!localAuditId) return
      try {
        await fetch('/api/gumroad/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audit_id: localAuditId, sale_id: saleId })
        })
      } catch (err) {
        console.error('Proactive session verification failed', err)
      }
    }
    verifySession()

    const poll = async () => {
      try {
        const params = new URLSearchParams()
        if (localAuditId) params.set('audit_id', localAuditId)
        if (saleId) params.set('sale_id', saleId)

        const response = await fetch(`/api/gumroad/status?${params.toString()}`, { cache: 'no-store' })

        if (!response.ok && response.status >= 500) {
          retries += 1
          if (retries >= 10 && active) {
            setError('We are unable to confirm your purchase status at this time.')
            return
          }
        } else {
          retries = 0
        }

        const result = await response.json()
        if (!active) return
        if (!response.ok) { setError(result.error ?? 'We could not find this purchase session.'); return }

        setStatus(result.status)
        if (result.ready || result.status === 'ready') {
          if (localAuditId) {
            try { localStorage.removeItem('pending_audit_id') } catch {}
          }
          if (result.reportUrl) {
            window.location.assign(result.reportUrl)
          } else {
            window.location.assign(`/results/${result.auditId || localAuditId}`)
          }
          return
        }
      } catch {
        retries += 1
        if (retries >= 10 && active) {
          setError('Payment status is temporarily unavailable.')
          return
        }
      }
      if (active) window.setTimeout(poll, 3000)
    }
    void poll()
    return () => {
      active = false
      clearTimeout(timeoutTimer)
    }
  }, [auditId, saleId, localAuditId])

  const isProcessing = status === 'payment_verified' || status === 'processing'

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-6 py-20">
      <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
        {isProcessing ? 'Payment confirmed — analyzing website' : 'Payment received — verifying purchase'}
      </p>
      <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight">Your report is being prepared.</h1>
      <p className="mt-5 max-w-xl text-pretty leading-7 text-muted-foreground">
        {error || (status === 'ready' ? 'Your report is ready. Opening it now…' : isProcessing ? 'Payment confirmed. AI is generating your detailed audit...' : 'Gumroad has returned you to the app. We are waiting for secure server-side verification and processing. You can leave this tab open.')}
      </p>
      {error ? (
        <button className="mt-8 w-fit rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" onClick={() => window.location.reload()}>Check again</button>
      ) : showFallbackButton ? (
        localAuditId ? (
          <a
            href={`/results/${localAuditId}`}
            className="mt-8 inline-block w-fit rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:-translate-y-0.5 transition-transform"
          >
            Access Your Full Report Now →
          </a>
        ) : (
          <p className="mt-8 text-sm text-red-500 font-medium">Could not find your session. Please check your email or enter your domain.</p>
        )
      ) : null}
    </main>
  )
}
