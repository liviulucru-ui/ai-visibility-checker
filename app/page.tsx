import { ArrowRight, Check } from 'lucide-react'
import { CTA, ReportPreview, Shell } from '@/components/marketing'

const questions = ['What are the best [category] in [city]?', 'Which [service] should I choose?', 'What are the best alternatives to [competitor]?']
const benefits = [['Visibility', 'How often your business appears in relevant searches.'], ['Recommendations', 'Whether your business is actually recommended for commercial-intent queries.'], ['Competitors', 'Which competitors appear instead of you.'], ['Evidence', 'Which search results and sources support the findings.'], ['Website signals', 'What your public website communicates to search systems.'], ['Action plan', 'The highest-priority actions to improve your visibility.']]

export default function Home() { return <Shell>
  <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1fr_.9fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
    <div>
      <p className="mb-6 inline-flex rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">AI Search Visibility Audit</p>
      <h1 className="max-w-3xl text-balance font-mono text-5xl font-bold leading-[1.02] tracking-[-0.07em] sm:text-6xl lg:text-7xl">When buyers ask AI who to choose, does your brand make the answer?</h1>
      <p className="mt-7 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">See how visible your business is across ChatGPT, Gemini, Perplexity and Google AI — and which competitors are being surfaced instead.</p>
      <div className="mt-9 flex flex-col gap-3 sm:flex-row"><CTA>Check My AI Visibility — Free</CTA><CTA href="/sample-report" variant="secondary">View Sample Report</CTA></div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span>Free scan. No credit card required.</span></div>
      <div className="mt-8 flex gap-4 text-xs font-semibold text-muted-foreground/80 tracking-widest uppercase"><span>ChatGPT</span><span>&middot;</span><span>Gemini</span><span>&middot;</span><span>Perplexity</span><span>&middot;</span><span>Google AI</span></div>
    </div>
    <ReportPreview />
  </section>

  <section className="border-y border-border bg-muted/30">
    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
      <div><p className="font-semibold text-foreground">See what AI finds</p><p className="mt-1 text-sm text-muted-foreground leading-6">Brand visibility across major AI discovery engines.</p></div>
      <div><p className="font-semibold text-foreground">Find missed buyer searches</p><p className="mt-1 text-sm text-muted-foreground leading-6">Identify questions where competitors appear instead.</p></div>
      <div><p className="font-semibold text-foreground">Understand why</p><p className="mt-1 text-sm text-muted-foreground leading-6">See source and visibility signals behind competitor advantage.</p></div>
      <div><p className="font-semibold text-foreground">Get the fix</p><p className="mt-1 text-sm text-muted-foreground leading-6">Unlock a prioritized action plan to improve your presence.</p></div>
    </div>
  </section>

  <section className="border-b border-border bg-muted/50"><div className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><div className="max-w-2xl"><p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent-foreground">The commercial problem</p><h2 className="mt-4 text-balance font-mono text-4xl font-bold tracking-[-0.05em] sm:text-5xl">Your customers are already asking AI what to buy.</h2><p className="mt-5 text-muted-foreground leading-7">Traditional SEO tells you where you appear in search results. AI visibility tells you whether your business is actually present when customers ask AI-powered search systems for recommendations.</p></div><div className="mt-10 grid gap-3 md:grid-cols-3">{questions.map(q => <div key={q} className="rounded-2xl border border-border bg-card p-6 font-mono text-sm font-semibold leading-6">“{q}”</div>)}</div><p className="mt-8 text-sm font-semibold">Your competitors may already be appearing in these answers.</p><div className="mt-6"><CTA>Check My AI Visibility — Free</CTA></div></div></section>
  <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><div className="max-w-2xl"><p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent-foreground">What you get</p><h2 className="mt-4 text-balance font-mono text-4xl font-bold tracking-[-0.05em] sm:text-5xl">See what AI sees about your business.</h2></div><div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{benefits.map(([title,text]) => <article key={title} className="rounded-2xl border border-border bg-card p-6"><div className="mb-8 flex size-9 items-center justify-center rounded-full bg-accent"><Check className="size-4 text-accent-foreground" /></div><h3 className="font-mono text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></article>)}</div></section>
  <section className="border-t border-border bg-primary text-primary-foreground"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-16 sm:flex-row sm:items-center sm:justify-between lg:px-8"><div><p className="font-mono text-3xl font-bold tracking-tight">Know where you stand before your competitors do.</p><p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/70">Start with a free initial audit, then unlock the complete report only if it is useful.</p></div><CTA href="/pricing" variant="secondary">View pricing</CTA></div></section>
</Shell> }
