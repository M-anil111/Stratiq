import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptIfPresent } from '@/lib/encryption'

// POST /api/projects/:projectId/credentials/:credId/decrypt
// Returns the decrypted password for one credential.
// Only authenticated users of the same org can access this.
export async function POST(
  _request: NextRequest,
  { params }: { params: { projectId: string; credId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('login_credentials')
    .select('encrypted_password')
    .eq('id', params.credId)
    .eq('project_id', params.projectId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const password = decryptIfPresent((data as any).encrypted_password)
  return NextResponse.json({ password })
}
