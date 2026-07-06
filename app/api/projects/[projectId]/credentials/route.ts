import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptIfPresent } from '@/lib/encryption'

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('login_credentials')
    .select('*')
    .eq('project_id', params.projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Strip encrypted_password — passwords are fetched on demand via the /decrypt endpoint
  const safe = (data || []).map(({ encrypted_password, ...rest }: any) => ({
    ...rest,
    has_password: !!encrypted_password,
  }))

  return NextResponse.json(safe)
}

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { site_name, username, password } = body

  const { data, error } = await supabase
    .from('login_credentials')
    .insert({
      project_id: params.projectId,
      site_name,
      username,
      encrypted_password: encryptIfPresent(password),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { encrypted_password, ...rest } = data as any
  return NextResponse.json({ ...rest, has_password: !!encrypted_password }, { status: 201 })
}
