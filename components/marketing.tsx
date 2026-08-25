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
  return <>
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
      <Link href="/" className="flex items-center gap-2 font-mono text-sm font-bold tracking-tight"><span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Sparkles className="size-4" /></span>visibility<span className="text-muted-foreground">.check</span></Link>
      <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">{navItems.map(([label, href]) => <Link key={href} href={href} className="transition-colors hover:text-foreground">{label}</Link>)}</nav>
      <Link href="/buy" className="hidden rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 sm:block">Get Report</Link>
      <button aria-label="Toggle menu" className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    </header>
    {open && <nav className="mx-5 flex flex-col gap-4 border-t border-border py-5 text-sm lg:hidden">{navItems.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}<Link href="/buy" onClick={() => setOpen(false)} className="font-semibold">Get Full Report — $19</Link></nav>}
  </>
}

export function CTA({ children = 'Check My AI Visibility — Free', href = '/check', variant = 'primary' }: { children?: React.ReactNode; href?: string; variant?: 'primary' | 'secondary' }) {
  return <Link href={href} className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 ${variant === 'primary' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground'}`}>{children}<ArrowRight className="size-4" /></Link>
}

export function ReportPreview({ large = false }: { large?: boolean }) {
  return <div className={`rounded-[1.75rem] border border-border bg-card p-5 shadow-2xl shadow-primary/10 ${large ? 'p-6 sm:p-8' : ''}`}>
    <div className="flex items-center justify-between border-b border-border pb-5"><div><p className="font-mono text-sm font-bold">AI Visibility Report</p><p className="mt-1 text-xs text-muted-foreground">Example report</p></div><span className="rounded-full bg-accent px-3 py-1 text-xs font-bold">ILLUSTRATIVE</span></div>
    <div className="grid gap-5 py-6 sm:grid-cols-[1fr_1.4fr] sm:items-center"><div className="flex items-center gap-4"><div className="relative flex size-28 shrink-0 items-center justify-center rounded-full border-[11px] border-accent"><span className="font-mono text-3xl font-bold">42</span></div><div><p className="text-xs text-muted-foreground">Visibility Score</p><p className="mt-1 text-sm font-semibold">Needs attention</p></div></div><div className="space-y-3 text-xs">{[['Your business','2 appearances','bg-accent'],['Competitors','7 appearances','bg-primary'],['Commercial queries analyzed','12','bg-muted-foreground']].map(([label,value,color]) => <div key={label} className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className={`rounded-full px-2 py-1 font-mono font-bold ${color} ${color === 'bg-accent' ? 'text-accent-foreground' : 'text-primary-foreground'}`}>{value}</span></div>)}</div></div>
    <div className="rounded-xl bg-muted p-4"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Commercial query presence</p><div className="space-y-3">{[['YOUR BUSINESS','2 / 12'],['COMPETITOR A','8 / 12'],['COMPETITOR B','6 / 12'],['COMPETITOR C','5 / 12']].map(([label,value]) => <div key={label} className="flex items-center gap-3 text-xs"><span className="w-32 font-mono font-bold">{label}</span><div className="h-2 flex-1 rounded-full bg-background"><div className={`h-2 rounded-full ${label === 'YOUR BUSINESS' ? 'bg-accent' : 'bg-primary'}`} style={{ width: `${Number(value[0]) / 12 * 100}%` }} /></div><span className="w-10 text-right font-mono">{value}</span></div>)}</div></div>
    <p className="mt-4 text-center text-[11px] font-medium text-muted-foreground">Example data — not a real audit.</p>
  </div>
}

export function FAQList({ items }: { items: [string, string][] }) { const [active, setActive] = useState<number | null>(0); return <div className="divide-y divide-border border-y border-border">{items.map(([q,a], i) => <div key={q} className="py-5"><button className="flex w-full items-center justify-between text-left font-semibold" onClick={() => setActive(active === i ? null : i)}>{q}<ChevronDown className={`size-4 transition-transform ${active === i ? 'rotate-180' : ''}`} /></button>{active === i && <p className="max-w-2xl pt-3 text-sm leading-6 text-muted-foreground">{a}</p>}</div>)}</div> }

export function Shell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen overflow-hidden bg-background text-foreground"><div className="border-b border-border bg-primary py-2 text-center text-xs font-medium tracking-wide text-primary-foreground">Your customers are already asking AI what to buy.</div><SiteNav />{children}<footer className="border-t border-border"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8"><p className="font-mono font-bold text-foreground">visibility.check</p><p>AI-powered search visibility for commercial decisions.</p><p>© 2026 Visibility Check</p></div></footer><Link href="/check" className="fixed inset-x-4 bottom-4 z-20 flex items-center justify-center rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-xl sm:hidden">Check My AI Visibility — Free</Link></main> }

export const CheckIcon = () => <Check className="mt-0.5 size-4 shrink-0 text-accent-foreground" />
