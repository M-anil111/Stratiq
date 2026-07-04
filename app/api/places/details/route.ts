import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const placeId = req.nextUrl.searchParams.get('place_id')
  if (!placeId) return NextResponse.json({ error: 'Missing place_id' }, { status: 400 })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Places API not configured' }, { status: 500 })

  try {
    const fields = 'name,formatted_phone_number,website,formatted_address,address_components'
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

    return NextResponse.json({
      name: r.name,
      phone: r.formatted_phone_number || '',
      website: r.website ? r.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : '',
      street_address: [streetNumber, streetName].filter(Boolean).join(' '),
      city: get('locality')?.long_name || get('sublocality')?.long_name || '',
      state: get('administrative_area_level_1')?.short_name || '',
      country: get('country')?.short_name || 'US',
    })
  } catch (err) {
    console.error('[places/details] fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 })
  }
}
