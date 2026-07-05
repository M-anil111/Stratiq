import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptIfPresent } from '@/lib/encryption'
import { requireRole, MANAGER_ROLES } from '@/lib/authz'

// POST /api/projects/:projectId/credentials/:credId/decrypt
// Returns the decrypted password for one credential.
// Restricted to managers/admins of the same org.
export async function POST(
  _request: NextRequest,
  { params }: { params: { projectId: string; credId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, MANAGER_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const { data, error } = await supabase
    .from('login_credentials')
    .select('encrypted_password, password_encrypted')
    .eq('id', params.credId)
    .eq('project_id', params.projectId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const encVal = (data as any).encrypted_password ?? (data as any).password_encrypted
  const password = decryptIfPresent(encVal)

  // Audit log — gracefully skip if table is missing (42P01)
  try {
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'credential_revealed',
      resource_type: 'login_credential',
      resource_id: params.credId,
      metadata: { project_id: params.projectId },
    })
  } catch (auditErr: any) {
    // 42P01 = undefined_table — ignore if audit_log doesn't exist in this environment
    if (auditErr?.code !== '42P01') {
      console.error('audit_log insert failed:', auditErr)
    }
  }

  return NextResponse.json({ password })
}
