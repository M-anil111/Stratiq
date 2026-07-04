import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Map Google Places types to our industry values
const INDUSTRY_MAP: Record<string, string> = {
  restaurant: 'Restaurant / Food & Beverage',
  food: 'Restaurant / Food & Beverage',
  cafe: 'Restaurant / Food & Beverage',
  bar: 'Restaurant / Food & Beverage',
  bakery: 'Restaurant / Food & Beverage',
  meal_takeaway: 'Restaurant / Food & Beverage',
  meal_delivery: 'Restaurant / Food & Beverage',
  clothing_store: 'Retail / E-commerce',
  store: 'Retail / E-commerce',
  shopping_mall: 'Retail / E-commerce',
  electronics_store: 'Retail / E-commerce',
  home_goods_store: 'Retail / E-commerce',
  furniture_store: 'Retail / E-commerce',
  book_store: 'Retail / E-commerce',
  hospital: 'Healthcare / Medical',
  doctor: 'Healthcare / Medical',
  dentist: 'Healthcare / Medical',
  pharmacy: 'Healthcare / Medical',
  health: 'Healthcare / Medical',
  physiotherapist: 'Healthcare / Medical',
  veterinary_care: 'Healthcare / Medical',
  lawyer: 'Legal / Law Firm',
  real_estate_agency: 'Real Estate',
  general_contractor: 'Construction / Contractor',
  plumber: 'Home Services / Plumbing / HVAC',
  electrician: 'Home Services / Plumbing / HVAC',
  roofing_contractor: 'Construction / Contractor',
  accounting: 'Finance / Accounting',
  finance: 'Finance / Accounting',
  bank: 'Finance / Accounting',
  insurance_agency: 'Finance / Accounting',
  university: 'Education',
  school: 'Education',
  primary_school: 'Education',
  secondary_school: 'Education',
  car_dealer: 'Automotive',
  car_repair: 'Automotive',
  car_rental: 'Automotive',
  beauty_salon: 'Beauty / Salon / Spa',
  hair_care: 'Beauty / Salon / Spa',
  spa: 'Beauty / Salon / Spa',
  gym: 'Beauty / Salon / Spa',
  night_club: 'Entertainment / Events',
  movie_theater: 'Entertainment / Events',
  amusement_park: 'Entertainment / Events',
  museum: 'Entertainment / Events',
  lodging: 'Travel / Hospitality',
  hotel: 'Travel / Hospitality',
  travel_agency: 'Travel / Hospitality',
  airport: 'Travel / Hospitality',
  church: 'Non-Profit',
  place_of_worship: 'Non-Profit',
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const placeId = req.nextUrl.searchParams.get('place_id')
  if (!placeId) return NextResponse.json({ error: 'Missing place_id' }, { status: 400 })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Places API not configured' }, { status: 500 })

  try {
    const fields = 'name,formatted_phone_number,website,formatted_address,address_components,types,editorial_summary'
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

    // Derive industry from Google types
    const types: string[] = r.types || []
    const industry = types.reduce((found: string, t: string) => found || INDUSTRY_MAP[t] || '', '') || ''

    // Categories: clean up Google types into readable labels
    const skipTypes = new Set(['point_of_interest', 'establishment', 'premise', 'street_address', 'route', 'locality', 'political', 'geocode'])
    const categories = types
      .filter(t => !skipTypes.has(t))
      .map(t => t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
      .slice(0, 5)

    // Description from editorial_summary
    const about = r.editorial_summary?.overview || ''

    return NextResponse.json({
      name: r.name,
      phone: r.formatted_phone_number || '',
      website: r.website ? r.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : '',
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
