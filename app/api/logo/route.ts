import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { domainFromUrl, logoUrlForDomain, faviconUrlForDomain } from '@/lib/logo'

// GET /api/logo?domain=example.com
// Returns candidate logo URLs for a domain (or full website URL). The client
// wizard renders the Clearbit logo with an <img onError> fallback to the
// favicon, so we return both URLs and keep this endpoint fast.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = request.nextUrl.searchParams.get('domain') || ''
  const domain = domainFromUrl(raw)
  if (!domain) return NextResponse.json({ error: 'Missing or invalid domain' }, { status: 400 })

  return NextResponse.json({
    domain,
    logo_url: logoUrlForDomain(domain),
    favicon_url: faviconUrlForDomain(domain),
  })
}
