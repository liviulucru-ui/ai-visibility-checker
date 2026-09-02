import { Check } from 'lucide-react'
import { CTA, ReportPreview, Shell } from '@/components/marketing'

const questions = [
  'What are the best [category] in [city]?',
  'Which [service] should I choose?',
  'What are the best alternatives to [competitor]?'
]

const benefits = [
  ['Visibility', 'How often your business appears in relevant searches.'],
  ['Recommendations', 'Whether your business is actually recommended for commercial-intent queries.'],
  ['Competitors', 'Which competitors appear instead of you.'],
  ['Evidence', 'Which search results and sources support the findings.'],
  ['Website signals', 'What your public website communicates to search systems.'],
  ['Action plan', 'The highest-priority actions to improve your visibility.']
]

export default function Home() {
  return (
    <Shell>
      {/* HERO */}
      <section className="relative overflow-hidden bg-black">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(163,230,53,0.12),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
        <div className="relative mx-auto grid max-w-7xl gap-16 px-6 pb-28 pt-24 lg:grid-cols-[1fr_.9fr] lg:items-center lg:px-8 lg:pb-40 lg:pt-32">
          <div>
            <p className="mb-8 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium tracking-wide text-white/70 backdrop-blur">
              AI Search Visibility Audit
            </p>
            <h1 className="max-w-3xl text-balance font-mono text-5xl font-bold leading-[1.02] tracking-[-0.07em] text-white sm:text-6xl lg:text-7xl">
              When buyers ask AI who to choose, does your brand make the answer?
            </h1>
            <p className="mt-8 max-w-xl text-pretty text-lg leading-8 text-white/60">
              See how visible your business is across ChatGPT, Gemini, Perplexity and Google AI — and which competitors are being surfaced instead.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <CTA href="/check">Check My AI Visibility — Free</CTA>
              <CTA href="/sample-report" variant="secondary">View Sample Report</CTA>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/40">
              <span>Free scan. No credit card required.</span>
            </div>
            <div className="mt-10 flex gap-4 text-xs font-semibold tracking-widest text-white/30 uppercase">
              <span>ChatGPT</span>
              <span>&middot;</span>
              <span>Gemini</span>
              <span>&middot;</span>
              <span>Perplexity</span>
              <span>&middot;</span>
              <span>Google AI</span>
            </div>
          </div>
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-2 backdrop-blur">
            <ReportPreview/>
          </div>
        </div>
      </section>

      {/* FEATURE STRIP */}
      <section className="border-y border-white/10 bg-neutral-950">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div>
            <p className="font-semibold text-white">See what AI finds</p>
            <p className="mt-2 text-sm leading-6 text-white/50">Brand visibility across major AI discovery engines.</p>
          </div>
          <div>
            <p className="font-semibold text-white">Find missed buyer searches</p>
            <p className="mt-2 text-sm leading-6 text-white/50">Identify questions where competitors appear instead.</p>
          </div>
          <div>
            <p className="font-semibold text-white">Understand why</p>
            <p className="mt-2 text-sm leading-6 text-white/50">See source and visibility signals behind competitor advantage.</p>
          </div>
          <div>
            <p className="font-semibold text-white">Get the fix</p>
            <p className="mt-2 text-sm leading-6 text-white/50">Unlock a prioritized action plan to improve your presence.</p>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-b border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-lime-400">The commercial problem</p>
            <h2 className="mt-5 text-balance font-mono text-4xl font-bold tracking-[-0.05em] text-white sm:text-5xl">
              Your customers are already asking AI what to buy.
            </h2>
            <p className="mt-6 leading-7 text-white/60">
              Traditional SEO tells you where you appear in search results. AI visibility tells you whether your business is actually present when customers ask AI-powered search systems for recommendations.
            </p>
          </div>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {questions.map(q => (
              <div
                key={q}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 font-mono text-sm font-semibold leading-6 text-white/90 backdrop-blur transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.06]"
              >
                “{q}”
              </div>
            ))}
          </div>
          <p className="mt-10 text-sm font-semibold text-white/80">Your competitors may already be appearing in these answers.</p>
          <div className="mt-7">
            <CTA href="/check">Check My AI Visibility — Free</CTA>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="bg-black">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-lime-400">What you get</p>
            <h2 className="mt-5 text-balance font-mono text-4xl font-bold tracking-[-0.05em] text-white sm:text-5xl">
              See what AI sees about your business.
            </h2>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map(([title, text]) => (
              <article
                key={title}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="mb-10 flex size-10 items-center justify-center rounded-full bg-lime-400">
                  <Check className="size-4 text-black"/>
                </div>
                <h3 className="font-mono text-lg font-bold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/50">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="relative overflow-hidden border-t border-white/10 bg-neutral-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_100%_50%,rgba(163,230,53,0.08),transparent)]" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-6 py-20 sm:flex-row sm:items-center sm:justify-between lg:px-8 lg:py-24">
          <div>
            <p className="font-mono text-3xl font-bold tracking-tight text-white">Know where you stand before your competitors do.</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/50">Start with a free initial audit, then unlock the complete report only if it is useful.</p>
          </div>
          <CTA href="/pricing" variant="secondary">View pricing</CTA>
        </div>
      </section>
    </Shell>
  )
}