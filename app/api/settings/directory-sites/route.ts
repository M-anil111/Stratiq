import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, ADMIN_ROLES } from '@/lib/authz'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim()

  let query = supabase
    .from('directory_sites')
    .select('*')
    .order('category')
    .order('domain')

  if (q) query = query.or(`url.ilike.%${q}%,domain.ilike.%${q}%,category.ilike.%${q}%`)

  const { data, error } = await query

  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, ADMIN_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const body = await request.json()

  const toDomain = (u: string) => {
    try {
      return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, '')
    } catch {
      return u
    }
  }

  // Bulk insert branch: { rows: [{ url, category, da_score }, ...] }
  if (Array.isArray(body.rows)) {
    const incoming = body.rows
      .map((r: any) => ({
        url: typeof r.url === 'string' ? r.url.trim() : '',
        category: typeof r.category === 'string' && r.category.trim() ? r.category.trim() : 'Directory',
        da_score: r.da_score != null && r.da_score !== '' && !isNaN(Number(r.da_score)) ? Number(r.da_score) : null,
      }))
      .filter((r: any) => r.url)
      .slice(0, 500)

    if (incoming.length === 0) return NextResponse.json({ error: 'No valid rows to import' }, { status: 400 })

    // Fetch existing URLs to skip exact duplicates (org-scoped via RLS)
    const { data: existing, error: existErr } = await supabase.from('directory_sites').select('url')
    if (existErr && existErr.code === '42P01') return NextResponse.json({ error: 'Table not found' }, { status: 500 })

    const existingUrls = new Set((existing || []).map((s: any) => s.url))
    const seen = new Set<string>()
    const toInsert: any[] = []
    let skipped = 0
    for (const r of incoming) {
      if (existingUrls.has(r.url) || seen.has(r.url)) { skipped++; continue }
      seen.add(r.url)
      toInsert.push({ url: r.url, domain: toDomain(r.url), category: r.category, da_score: r.da_score })
    }

    let imported = 0
    if (toInsert.length > 0) {
      const { data: inserted, error: insErr } = await supabase.from('directory_sites').insert(toInsert).select('id')
      if (insErr) {
        if (insErr.code === '42P01') return NextResponse.json({ error: 'Table not found' }, { status: 500 })
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
      imported = (inserted || []).length
    }

    return NextResponse.json({ imported, skipped }, { status: 201 })
  }

  const { url, category, da_score } = body

  if (!url || !category) return NextResponse.json({ error: 'url and category are required' }, { status: 400 })

  let domain = url
  try {
    domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {}

  const { data, error } = await supabase
    .from('directory_sites')
    .insert({ url, domain, category, da_score: da_score ?? null })
    .select()
    .single()

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ error: 'Table not found' }, { status: 500 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
