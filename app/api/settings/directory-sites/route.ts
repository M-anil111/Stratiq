import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('directory_sites')
    .select('*')
    .order('category')
    .order('domain')

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

  const body = await request.json()
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
