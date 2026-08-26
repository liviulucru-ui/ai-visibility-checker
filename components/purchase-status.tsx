'use client'

import { useEffect, useState } from 'react'

export function PurchaseStatus({ auditId, saleId }: { auditId: string; saleId?: string }) {
  const [status, setStatus] = useState('verifying')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const localAuditId = auditId || (typeof window !== 'undefined' ? localStorage.getItem('pending_audit_id') || '' : '')

    const poll = async () => {
      try {
        const params = new URLSearchParams()
        if (localAuditId) params.set('audit_id', localAuditId)
        if (saleId) params.set('sale_id', saleId)

        const response = await fetch(`/api/gumroad/status?${params.toString()}`, { cache: 'no-store' })
        const result = await response.json()
        if (!active) return
        if (!response.ok) { setError(result.error ?? 'We could not find this purchase session.'); return }
        setStatus(result.status)
        if (result.reportReady && result.reportUrl) {
          if (localAuditId) {
            try { localStorage.removeItem('pending_audit_id') } catch {}
          }
          window.location.assign(result.reportUrl)
          return
        }
      } catch { if (active) setError('Payment status is temporarily unavailable.') }
      if (active) window.setTimeout(poll, 3000)
    }
    void poll()
    return () => { active = false }
  }, [auditId, saleId])

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
      {error ? <button className="mt-8 w-fit rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" onClick={() => window.location.reload()}>Check again</button> : null}
    </main>
  )
}
