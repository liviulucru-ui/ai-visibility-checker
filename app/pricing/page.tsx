import { ContentPage, PricingCards } from '@/components/content-page'
import { FAQList } from '@/components/marketing'

export default function Pricing() {
  return (
    <ContentPage eyebrow="Pricing" title="Simple, one-time pricing." intro="No subscriptions. No recurring fees. Get a complete, prioritized action plan for your business visibility.">
      <PricingCards />
      <div className="mt-24">
        <h2 className="mb-8 font-mono text-2xl font-bold tracking-tight">Frequently asked questions</h2>
        <FAQList items={[
          ['What does the free check include?', 'The free check gives you an immediate AI visibility score and shows you exactly how your business is currently perceived by commercial-intent searches. It samples 8–12 queries in your niche.'],
          ['What is in the full report?', 'The full report expands the analysis to 20–30 queries, provides a detailed breakdown of the exact technical and content gaps giving your competitors an edge, and generates a prioritized 30-day action plan to improve your visibility.'],
          ['How is this different from SEO?', 'Traditional SEO focuses on keyword rankings and backlinks. AI search systems (like ChatGPT, Perplexity, and Google AI Overviews) synthesize answers based on entity recognition, sentiment, and semantic relevance. You can rank #1 on Google and still not be recommended by AI. This report specifically targets AI recommendation engines.'],
          ['Do I need technical skills to implement the recommendations?', 'No. The 30-day action plan prioritizes changes based on effort and impact. Most recommendations involve updating your website copy, adding schema markup, or claiming business profiles.'],
          ['Is this a subscription?', 'No. The report is a one-time purchase of $19. You can re-run the audit later by purchasing a new report if you want to track your progress.'],
        ]} />
      </div>
    </ContentPage>
  )
}
