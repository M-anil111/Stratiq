import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  if (!query || query.length < 2) return NextResponse.json({ results: [] })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return NextResponse.json({ results: [] })

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=establishment&key=${apiKey}`
    const res = await fetch(url)
    const data = await res.json()
    const results = (data.results || []).slice(0, 6).map((p: any) => ({
      name: p.name,
      address: p.formatted_address,
      place_id: p.place_id,
    }))
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
