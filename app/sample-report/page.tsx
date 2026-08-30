import { ContentPage } from '@/components/content-page'
import { CTA } from '@/components/marketing'

export default function SampleReport() {
  return (
    <ContentPage eyebrow="Example Full Brand Visibility Report" title="See exactly what a complete $19 audit includes." intro="This preview uses illustrative data to show the structure and level of detail—not a real audit or a promise of results.">

      <div className="max-w-4xl space-y-6">

        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-muted/40 px-6 py-4 text-xs text-muted-foreground font-mono">
          <span className="font-semibold text-foreground">Scan Coverage:</span>
          <span>15 buyer searches checked</span>
          <span>&middot;</span>
          <span>4 AI engines evaluated</span>
          <span>&middot;</span>
          <span>United States</span>
          <span>&middot;</span>
          <span>Completed Aug 30, 2026</span>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-violet-400/40 bg-violet-500/10 p-6 md:col-span-1 flex flex-col justify-center">
            <p className="text-xs text-violet-500 uppercase tracking-widest font-semibold mb-2">AI Visibility Score</p>
            <p className="font-mono text-6xl font-bold text-yellow-500">42<span className="text-2xl text-violet-400/50">/100</span></p>
            <div className="mt-4">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold bg-yellow-500/20 text-yellow-600">
                Presence: Moderate
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 md:col-span-2">
            <h3 className="font-semibold text-lg mb-4">Visibility Signals</h3>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1"><span>Brand Discoverability</span><span className="font-mono">85%</span></div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: '85%' }}></div></div>
                <p className="text-[10px] text-muted-foreground mt-1">How clearly AI/search systems identify the brand.</p>
              </div>
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1"><span>Commercial Search Presence</span><span className="font-mono">20%</span></div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-accent" style={{ width: '20%' }}></div></div>
                <p className="text-[10px] text-muted-foreground mt-1">How often the brand appears for commercial-intent searches.</p>
              </div>
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1"><span>Source Authority</span><span className="font-mono">40%</span></div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-violet-500" style={{ width: '40%' }}></div></div>
                <p className="text-[10px] text-muted-foreground mt-1">Strength of supporting sources, listings, and structured signals.</p>
              </div>
            </div>
          </div>
        </div>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4 text-lg">Executive Summary</h3>
          <p className="text-sm leading-7 text-muted-foreground">Your brand is clearly identifiable by major discovery systems when searched by name, but struggles significantly to appear in non-branded, commercial-intent searches. Competitors are actively winning these discovery queries because they have broader coverage across authoritative industry directories and review platforms. The immediate priority is establishing your brand entity across these key external sources.</p>
        </section>



        <section className="rounded-3xl border border-border bg-card overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold text-lg">Searches That Decide Who Gets Recommended</h3>
            <p className="text-sm text-muted-foreground mt-1">Sample of high-intent buyer searches analyzed.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-semibold">Buyer Search</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Competitor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { q: 'best b2b accounting software', s: 'Missing', c: 'Competitor A' },
                  { q: 'accounting software for startups', s: 'Missing', c: 'Competitor B' },
                  { q: 'top accounting platforms 2026', s: 'Competitor Wins', c: 'Competitor A' },
                  { q: 'affordable accounting solutions', s: 'Found', c: '—' }
                ].map((ev, i) => (
                  <tr key={i} className="bg-card">
                    <td className="px-6 py-4 font-medium max-w-[250px] truncate">"{ev.q}"</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${ev.s === 'Found' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                        {ev.s}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground truncate max-w-[200px]">{ev.c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4 text-lg">Competitor Intelligence</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { name: 'Competitor A', domain: 'competitor-a.com', adv: 'Strong category relevance and repeated third-party discovery on software review platforms.' },
              { name: 'Competitor B', domain: 'competitor-b.com', adv: 'High volume of structured citations across regional and industry-specific directories.' }
            ].map(comp => (
              <div key={comp.domain} className="p-5 rounded-2xl bg-muted/40 border border-border/50">
                <p className="font-bold">{comp.name}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono mb-4">{comp.domain}</p>
                <p className="text-xs leading-5"><span className="font-semibold text-foreground">AI Advantage:</span> {comp.adv}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4 text-lg">Priority Action Plan</h3>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 p-5 rounded-2xl bg-muted/30 border border-muted">
              <div className="shrink-0 sm:w-28 flex sm:flex-col gap-3 sm:gap-1 items-center sm:items-start">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Week 1</p>
                <span className="inline-block px-2 py-0.5 text-[10px] uppercase font-bold rounded bg-red-500/10 text-red-500 border border-red-500/20">Critical</span>
              </div>
              <div>
                <p className="text-sm font-bold">Add Organization structured data to the homepage with your brand name, official URL, logo and verified social profiles.</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-2">📍 Homepage</p>
                <p className="text-sm text-muted-foreground mt-2 leading-6"><span className="font-medium text-foreground">Why:</span> Helps search and AI systems consistently identify your business entity.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 p-5 rounded-2xl bg-muted/30 border border-muted">
              <div className="shrink-0 sm:w-28 flex sm:flex-col gap-3 sm:gap-1 items-center sm:items-start">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Week 2</p>
                <span className="inline-block px-2 py-0.5 text-[10px] uppercase font-bold rounded bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">High</span>
              </div>
              <div>
                <p className="text-sm font-bold">Get listed on the same relevant industry software review sources where competitors repeatedly appear (e.g. G2, Capterra).</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-2">📍 Third-party directories</p>
                <p className="text-sm text-muted-foreground mt-2 leading-6"><span className="font-medium text-foreground">Why:</span> Engines like Perplexity rely heavily on these trusted third-party citations to form recommendations.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-12 mb-8 flex justify-center">
          <CTA href="/check">Run a Free Audit on My Business</CTA>
        </div>

      </div>
    </ContentPage>
  )
}
