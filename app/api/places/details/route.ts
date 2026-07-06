import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const INDUSTRY_MAP: Record<string, string> = {
  // Food & Beverage
  restaurant: 'Restaurant / Food & Beverage',
  food: 'Restaurant / Food & Beverage',
  cafe: 'Restaurant / Food & Beverage',
  bar: 'Restaurant / Food & Beverage',
  bakery: 'Restaurant / Food & Beverage',
  meal_takeaway: 'Restaurant / Food & Beverage',
  meal_delivery: 'Restaurant / Food & Beverage',
  night_club: 'Restaurant / Food & Beverage',
  // Retail
  clothing_store: 'Retail / E-commerce',
  store: 'Retail / E-commerce',
  shopping_mall: 'Retail / E-commerce',
  electronics_store: 'Retail / E-commerce',
  home_goods_store: 'Retail / E-commerce',
  furniture_store: 'Retail / E-commerce',
  book_store: 'Retail / E-commerce',
  jewelry_store: 'Retail / E-commerce',
  shoe_store: 'Retail / E-commerce',
  pet_store: 'Retail / E-commerce',
  convenience_store: 'Retail / E-commerce',
  supermarket: 'Retail / E-commerce',
  // Healthcare
  hospital: 'Healthcare / Medical',
  doctor: 'Healthcare / Medical',
  dentist: 'Healthcare / Medical',
  pharmacy: 'Healthcare / Medical',
  health: 'Healthcare / Medical',
  physiotherapist: 'Healthcare / Medical',
  veterinary_care: 'Healthcare / Medical',
  // Legal
  lawyer: 'Legal / Law Firm',
  courthouse: 'Legal / Law Firm',
  // Real Estate
  real_estate_agency: 'Real Estate',
  // Construction
  general_contractor: 'Construction / Contractor',
  roofing_contractor: 'Construction / Contractor',
  painter: 'Construction / Contractor',
  // Home Services
  plumber: 'Home Services / Plumbing / HVAC',
  electrician: 'Home Services / Plumbing / HVAC',
  locksmith: 'Home Services / Plumbing / HVAC',
  moving_company: 'Home Services / Plumbing / HVAC',
  storage: 'Home Services / Plumbing / HVAC',
  // Finance
  accounting: 'Finance / Accounting',
  finance: 'Finance / Accounting',
  bank: 'Finance / Accounting',
  insurance_agency: 'Finance / Accounting',
  atm: 'Finance / Accounting',
  // Technology & Professional Services
  technology: 'Technology / SaaS',
  software: 'Technology / SaaS',
  // Consulting & Marketing
  management_consulting: 'Consulting / Professional Services',
  business_management_consultant: 'Consulting / Professional Services',
  consultant: 'Consulting / Professional Services',
  business_service: 'Consulting / Professional Services',
  corporate_office: 'Consulting / Professional Services',
  professional_services: 'Consulting / Professional Services',
  marketing_agency: 'Consulting / Professional Services',
  advertising_agency: 'Consulting / Professional Services',
  public_relations: 'Consulting / Professional Services',
  // Education
  university: 'Education',
  school: 'Education',
  primary_school: 'Education',
  secondary_school: 'Education',
  tutoring: 'Education',
  // Automotive
  car_dealer: 'Automotive',
  car_repair: 'Automotive',
  car_rental: 'Automotive',
  car_wash: 'Automotive',
  // Beauty
  beauty_salon: 'Beauty / Salon / Spa',
  hair_care: 'Beauty / Salon / Spa',
  spa: 'Beauty / Salon / Spa',
  gym: 'Beauty / Salon / Spa',
  // Entertainment
  movie_theater: 'Entertainment / Events',
  amusement_park: 'Entertainment / Events',
  museum: 'Entertainment / Events',
  art_gallery: 'Entertainment / Events',
  bowling_alley: 'Entertainment / Events',
  // Travel
  lodging: 'Travel / Hospitality',
  hotel: 'Travel / Hospitality',
  travel_agency: 'Travel / Hospitality',
  airport: 'Travel / Hospitality',
  // Non-Profit
  church: 'Non-Profit',
  place_of_worship: 'Non-Profit',
  charity: 'Non-Profit',
}

const SKIP_TYPES = new Set([
  'point_of_interest', 'establishment', 'premise', 'street_address',
  'route', 'locality', 'political', 'geocode', 'subpremise',
])

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const placeId = req.nextUrl.searchParams.get('place_id')
  if (!placeId) return NextResponse.json({ error: 'Missing place_id' }, { status: 400 })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Places API not configured' }, { status: 500 })

  try {
    // Include reviews as fallback for about description
    const fields = 'name,formatted_phone_number,website,formatted_address,address_components,types,editorial_summary,reviews'
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${apiKey}`
    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== 'OK') {
      console.error('[places/details] Google error:', data.status, data.error_message)
      return NextResponse.json({ error: data.status })
    }

    const r = data.result
    const comps: any[] = r.address_components || []
    const get = (type: string) => comps.find((c: any) => c.types.includes(type))

    const streetNumber = get('street_number')?.long_name || ''
    const streetName = get('route')?.long_name || ''

    const types: string[] = r.types || []
    const industry = types.reduce((found: string, t: string) => found || INDUSTRY_MAP[t] || '', '') || ''

    const categories = types
      .filter(t => !SKIP_TYPES.has(t))
      .map(t => t.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))
      .slice(0, 6)

    // About: editorial_summary first, then best review as fallback
    let about = r.editorial_summary?.overview || ''
    if (!about && r.reviews?.length > 0) {
      // Use the longest review text as description (most descriptive)
      const best = [...r.reviews].sort((a: any, b: any) => (b.text?.length || 0) - (a.text?.length || 0))[0]
      if (best?.text) about = best.text.slice(0, 300)
    }

    // Clean website: strip protocol and trailing slash
    const websiteRaw = r.website || ''
    const website = websiteRaw.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '')

    // Auto-suggest email from website domain if not available from Google
    // (Google Places API does not provide business email)
    const emailSuggestion = website ? `info@${website.split('/')[0]}` : ''

    return NextResponse.json({
      name: r.name,
      phone: r.formatted_phone_number || '',
      website,
      email_suggestion: emailSuggestion,
      street_address: [streetNumber, streetName].filter(Boolean).join(' '),
      city: get('locality')?.long_name || get('sublocality')?.long_name || '',
      state: get('administrative_area_level_1')?.short_name || '',
      country: get('country')?.short_name || 'US',
      industry,
      categories,
      about,
    })
  } catch (err) {
    console.error('[places/details] fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 })
  }
}
