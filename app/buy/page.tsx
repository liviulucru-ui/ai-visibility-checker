import { ContentPage } from '@/components/content-page'
import { CTA } from '@/components/marketing'
import { PurchaseForm } from '@/components/purchase-form'

export default async function Buy({ searchParams }: { searchParams: Promise<{ audit_id?: string }> }) {
  const params = await searchParams
  return (
    <ContentPage eyebrow="Full report" title="Unlock the complete visibility report for $19." intro="One-time payment. No subscription. Add your business details first so Gumroad can return you to the right report after verified payment.">
      <div className="max-w-2xl rounded-3xl border border-primary bg-primary p-7 text-primary-foreground">
        <p className="font-mono text-4xl font-bold">$19</p>
        <p className="mt-2 text-sm text-primary-foreground/70">One-time purchase</p>
        <ul className="mt-8 space-y-3 text-sm">
          <li>20–30 commercial-intent queries</li>
          <li>Detailed competitor comparison</li>
          <li>Query-level evidence and website signals</li>
          <li>Prioritized recommendations and 30-day action plan</li>
          <li>Professional PDF report with email delivery</li>
        </ul>
        <PurchaseForm auditId={params.audit_id} />
        <p className="mt-4 text-xs text-primary-foreground/60">Checkout uses the configured Gumroad product. Report access is granted only after server-side sale verification.</p>
      </div>
      <div className="mt-8">
        <CTA href="/check" variant="secondary">Not ready? Start free instead</CTA>
      </div>
    </ContentPage>
  )
}
