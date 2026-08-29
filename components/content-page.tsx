import { CTA, FAQList, ReportPreview, Shell, CheckIcon } from '@/components/marketing'

export function ContentPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children?: React.ReactNode }) { return <Shell><section className="mx-auto max-w-5xl px-5 pb-20 pt-16 lg:px-8 lg:pt-24"><p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent-foreground">{eyebrow}</p><h1 className="mt-4 max-w-4xl text-balance font-mono text-5xl font-bold leading-[1.02] tracking-[-0.07em] sm:text-6xl">{title}</h1>{intro && <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{intro}</p>}<div className="mt-12">{children}</div></section></Shell> }

export function PricingCards({ auditId }: { auditId?: string }) { const plans = [['FREE', '$0', ['Initial visibility check', '8–12 sampled queries', 'Basic visibility result', 'Limited competitor comparison', 'Key findings'], '/check', 'Check My AI Visibility — Free'], ['FULL REPORT', '$19 one-time', ['Full ChatGPT analysis', 'Full Gemini analysis', 'Full Perplexity analysis', 'Full Google AI analysis', 'Complete buyer search evidence', 'Competitor gap analysis', 'Priority recommendations', '30-day action plan', 'Instant PDF export & web report access'], auditId ? `/buy?auditId=${auditId}` : '/buy', 'Get Full Report — $19']] as const; return <div className="grid gap-5 md:grid-cols-2">{plans.map(([name, price, items, href, cta]) => <article key={name} className={`rounded-3xl border p-7 ${name === 'FULL REPORT' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}><p className="font-mono text-xs font-bold tracking-[0.2em]">{name}</p><p className="mt-4 font-mono text-4xl font-bold">{price}</p><ul className="my-8 space-y-3 text-sm">{items.map(item => <li key={item} className="flex gap-2"><CheckIcon />{item}</li>)}</ul>{name === 'FULL REPORT' ? (
  <>
    <CTA href="/check" variant="secondary">Start Free Audit First →</CTA>
    <p className="mt-4 text-xs text-primary-foreground/70 leading-relaxed">Run your free baseline audit first, then unlock the full report with 1 click.</p>
  </>
) : (
  <CTA href={href} variant="primary">{cta}</CTA>
)}</article>)}</div> }
