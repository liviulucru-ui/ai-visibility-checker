'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, ChevronDown, Menu, Sparkles, X } from 'lucide-react'

export const navItems = [
  ['How It Works', '/how-it-works'],
  ['Insights', '/insights'],
  ['Pricing', '/pricing'],
  ['Sample Report', '/sample-report'],
  ['FAQ', '/faq'],
] as const

export function SiteNav() {
  const [open, setOpen] = useState(false)
  const isHome = typeof window !== 'undefined' && window.location.pathname === '/'
  const ctaHref = isHome ? '#audit-form' : '/check'

  return <>
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
      <Link href="/" className="flex items-center gap-2 font-mono text-sm font-bold tracking-tight"><span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Sparkles className="size-4" /></span>AIBrand<span className="text-muted-foreground">Check</span></Link>
      <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">{navItems.map(([label, href]) => <Link key={href} href={href} className="transition-colors hover:text-foreground">{label}</Link>)}</nav>
      <Link href={ctaHref} className="hidden rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 sm:block">Free Audit</Link>
      <button aria-label="Toggle menu" className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    </header>
    {open && <nav className="mx-5 flex flex-col gap-4 border-t border-border py-5 text-sm lg:hidden">{navItems.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}<Link href={ctaHref} onClick={() => setOpen(false)} className="font-semibold">Free Audit</Link></nav>}
  </>
}

export function CTA({ children = 'Check My AI Visibility — Free', href = '/check', variant = 'primary' }: { children?: React.ReactNode; href?: string; variant?: 'primary' | 'secondary' }) {
  return <Link href={href} className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 ${variant === 'primary' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground'}`}>{children}<ArrowRight className="size-4" /></Link>
}

export function ReportPreview({ large = false }: { large?: boolean }) {
  return <div className={`rounded-[1.75rem] border border-border bg-card p-5 shadow-2xl shadow-primary/10 ${large ? 'p-6 sm:p-8' : ''}`}>
    <div className="flex items-center justify-between border-b border-border pb-5"><div><p className="font-mono text-sm font-bold">AI Visibility Report</p><p className="mt-1 text-xs text-muted-foreground">Strategic Intelligence Dashboard</p></div><span className="rounded-full bg-accent px-3 py-1 text-[10px] uppercase font-bold tracking-widest text-accent-foreground">ILLUSTRATIVE</span></div>

    <div className="grid gap-5 py-6 sm:grid-cols-[1fr_1.4fr] sm:items-center">
      <div className="flex items-center gap-4">
        <div className="relative flex size-24 shrink-0 items-center justify-center rounded-full border-[10px] border-accent"><span className="font-mono text-3xl font-bold">42</span></div>
        <div><p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Visibility Score</p><p className="mt-1 text-sm font-medium">Needs attention</p></div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl bg-muted/50 p-3"><p className="text-muted-foreground mb-1 font-semibold">ChatGPT</p><p className="font-mono font-bold text-red-500">Low</p></div>
        <div className="rounded-xl bg-muted/50 p-3"><p className="text-muted-foreground mb-1 font-semibold">Gemini</p><p className="font-mono font-bold text-yellow-600">Medium</p></div>
        <div className="rounded-xl bg-muted/50 p-3"><p className="text-muted-foreground mb-1 font-semibold">Perplexity</p><p className="font-mono font-bold text-red-500">Low</p></div>
        <div className="rounded-xl bg-muted/50 p-3"><p className="text-muted-foreground mb-1 font-semibold">Google AI</p><p className="font-mono font-bold text-yellow-600">Medium</p></div>
      </div>
    </div>

    <div className="rounded-xl bg-muted p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Missed Buyer Search</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-background"><span className="font-semibold truncate pr-4">"best accounting software for startups"</span></div>
        <div className="grid grid-cols-2 gap-2 text-xs">
           <div className="p-2 rounded-lg bg-background border border-red-500/20"><p className="text-muted-foreground mb-1">Your Brand</p><p className="font-semibold text-red-600">Missing</p></div>
           <div className="p-2 rounded-lg bg-background border border-green-500/20"><p className="text-muted-foreground mb-1">Competitor</p><p className="font-semibold text-green-600">Found</p></div>
        </div>
      </div>
    </div>
    <p className="mt-4 text-center text-[11px] font-medium text-muted-foreground">Example data — not a real audit.</p>
  </div>
}

export function FAQList({ items }: { items: [string, string][] }) { const [active, setActive] = useState<number | null>(0); return <div className="divide-y divide-border border-y border-border">{items.map(([q,a], i) => <div key={q} className="py-5"><button className="flex w-full items-center justify-between text-left font-semibold" onClick={() => setActive(active === i ? null : i)}>{q}<ChevronDown className={`size-4 transition-transform ${active === i ? 'rotate-180' : ''}`} /></button>{active === i && <p className="max-w-2xl pt-3 text-sm leading-6 text-muted-foreground">{a}</p>}</div>)}</div> }

export function Shell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen overflow-hidden bg-background text-foreground"><div className="border-b border-border bg-primary py-2 text-center text-xs font-medium tracking-wide text-primary-foreground">Your customers are already asking AI what to buy.</div><SiteNav />{children}<footer className="border-t border-border"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8"><p className="font-mono font-bold text-foreground">AIBrandCheck</p><p>AI-powered search visibility for commercial decisions.</p><p>© 2026 AIBrandCheck</p></div></footer><Link href="/check" className="fixed inset-x-4 bottom-4 z-20 flex items-center justify-center rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-xl sm:hidden">Check My Visibility — Free</Link></main> }

export const CheckIcon = () => <Check className="mt-0.5 size-4 shrink-0 text-accent-foreground" />
