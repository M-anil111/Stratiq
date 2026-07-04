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

export function getUpsellRecommendations(currentServices: string[]): UpsellRecommendation[] {
  return ALL_SERVICES
    .filter(service => !service.requires_not.some(s => currentServices.includes(s)))
    .map((service, i) => ({
      id: service.id,
      title: service.title,
      description: service.description,
      monthly_price: service.monthly_price,
      priority: i < 2 ? 'high' : i < 4 ? 'medium' : 'low',
      category: service.category,
    }))
}

export function getTopUpsell(currentServices: string[]): UpsellRecommendation | null {
  const recs = getUpsellRecommendations(currentServices)
  return recs[0] || null
}
