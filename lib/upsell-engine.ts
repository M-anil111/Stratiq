export interface UpsellRecommendation {
  id: string
  title: string
  description: string
  monthly_price: number
  priority: 'high' | 'medium' | 'low'
  category: string
}

const ALL_SERVICES = [
  { id: 'google-ads', title: 'Google Ads Management', description: 'Drive targeted traffic with expertly managed paid search campaigns. Average client sees 3x ROAS.', monthly_price: 750, category: 'Paid Advertising', requires_not: ['Google Ads'] },
  { id: 'meta-ads', title: 'Meta Ads Management', description: 'Reach your audience on Facebook and Instagram with precision-targeted ad campaigns.', monthly_price: 650, category: 'Paid Advertising', requires_not: ['Meta Ads'] },
  { id: 'content-writing', title: 'Content Writing', description: 'Monthly blog posts and website copy to boost organic rankings and engage visitors.', monthly_price: 500, category: 'Content', requires_not: ['Content Writing'] },
  { id: 'email-marketing', title: 'Email Marketing', description: 'Nurture leads and retain customers with automated email sequences and newsletters.', monthly_price: 400, category: 'Email', requires_not: ['Email Marketing'] },
  { id: 'social-media', title: 'Social Media Management', description: 'Consistent posting and engagement across all your social channels, handled for you.', monthly_price: 600, category: 'Social Media', requires_not: ['Social Media Management'] },
  { id: 'local-seo', title: 'Local SEO Package', description: 'Dominate local search results with citation building, Google Business optimization, and review management.', monthly_price: 350, category: 'SEO', requires_not: ['Local SEO'] },
  { id: 'web-design', title: 'Website Redesign', description: 'Modern, conversion-optimised website that turns visitors into customers.', monthly_price: 2500, category: 'Web Design', requires_not: ['Web Design'] },
]

/**
 * Cross-sell pairs: if the client has the left service but not the right,
 * the right service gets a priority boost.
 */
const CROSS_SELL_BOOSTS: Array<{ has: string; recommend: string }> = [
  { has: 'Meta Ads', recommend: 'google-ads' },
  { has: 'Google Ads', recommend: 'meta-ads' },
  { has: 'Content Writing', recommend: 'local-seo' },
  { has: 'Social Media Management', recommend: 'meta-ads' },
]

export function getUpsellRecommendations(currentServices: string[]): UpsellRecommendation[] {
  // Services that should be boosted to high priority due to cross-sell logic
  const boostedIds = new Set<string>()
  for (const rule of CROSS_SELL_BOOSTS) {
    if (currentServices.includes(rule.has)) {
      boostedIds.add(rule.recommend)
    }
  }

  const eligible = ALL_SERVICES.filter(
    service => !service.requires_not.some(s => currentServices.includes(s))
  )

  // Sort: boosted services first, then by monthly price descending
  const sorted = [...eligible].sort((a, b) => {
    const aBoosted = boostedIds.has(a.id) ? 1 : 0
    const bBoosted = boostedIds.has(b.id) ? 1 : 0
    if (bBoosted !== aBoosted) return bBoosted - aBoosted
    return b.monthly_price - a.monthly_price
  })

  return sorted.map((service, i) => {
    let priority: 'high' | 'medium' | 'low'
    if (boostedIds.has(service.id) || i < 2) priority = 'high'
    else if (i < 4) priority = 'medium'
    else priority = 'low'

    return {
      id: service.id,
      title: service.title,
      description: service.description,
      monthly_price: service.monthly_price,
      priority,
      category: service.category,
    }
  })
}

export function getTopUpsell(currentServices: string[]): UpsellRecommendation | null {
  const recs = getUpsellRecommendations(currentServices)
  return recs[0] || null
}
