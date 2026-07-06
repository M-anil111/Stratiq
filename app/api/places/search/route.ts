import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = req.nextUrl.searchParams.get('q')
  if (!query || query.length < 2) return NextResponse.json({ results: [] })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    console.error('[places/search] GOOGLE_PLACES_API_KEY not set')
    return NextResponse.json({ results: [] })
  }

  try {
    // Autocomplete API is designed for real-time-as-you-type — much faster than Text Search
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=establishment&key=${apiKey}`
    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[places/search] Google API error:', data.status, data.error_message)
      return NextResponse.json({ results: [] })
    }

    // predictions[].description = "Business Name, City, State, Country"
    // predictions[].structured_formatting.main_text = just the business name
    const results = (data.predictions || []).slice(0, 6).map((p: any) => ({
      name: p.structured_formatting?.main_text || p.description,
      address: p.structured_formatting?.secondary_text || '',
      place_id: p.place_id,
    }))

    return NextResponse.json({ results })
  } catch (err) {
    console.error('[places/search] fetch error:', err)
    return NextResponse.json({ results: [] })
  }
}
