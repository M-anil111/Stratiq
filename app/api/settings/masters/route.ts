import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/index'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const category = request.nextUrl.searchParams.get('category')
  const status = request.nextUrl.searchParams.get('status') // 'approved', 'pending', 'all'

  let query = supabase
    .from('masters')
    .select('*, created_by_user:users!created_by(full_name, email), approved_by_user:users!approved_by(full_name)')
    .eq('organization_id', userData.organization_id)
    .order('sort_order')
    .order('label')

  if (category) query = query.eq('category', category)
  if (status === 'all') {
    // no filter
  } else if (status === 'pending') {
    query = query.eq('approval_status', 'pending')
  } else {
    query = query.eq('approval_status', 'approved').eq('is_active', true)
  }

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

  const { data: userData } = await supabase.from('users').select('organization_id, role, full_name, email').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()
  const isAdmin = ['super_admin', 'admin'].includes(userData.role)
  const approvalStatus = isAdmin ? 'approved' : 'pending'

  const { data, error } = await supabase
    .from('masters')
    .insert({
      organization_id: userData.organization_id,
      category: body.category,
      value: body.value || body.label,
      label: body.label,
      description: body.description || null,
      metadata: body.metadata || {},
      sort_order: body.sort_order || 0,
      is_active: true,
      approval_status: approvalStatus,
      created_by: user.id,
      approved_by: isAdmin ? user.id : null,
      approved_at: isAdmin ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If pending, notify admins
  if (approvalStatus === 'pending') {
    try {
      const { data: admins } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('organization_id', userData.organization_id)
        .in('role', ['super_admin', 'admin'])

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stratiqnow.com'
      for (const admin of admins || []) {
        await sendEmail({
          to: admin.email,
          subject: `Approval Required: New ${body.category} value — "${body.label}"`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;background:#0a1628;color:#e2e8f0;border-radius:12px;overflow:hidden">
              <div style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:20px 28px">
                <h1 style="margin:0;font-size:18px;color:#fff">Approval Required</h1>
                <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px">A new dropdown value needs your approval</p>
              </div>
              <div style="padding:24px">
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:120px">Category</td><td style="color:#f1f5f9;font-weight:600;text-transform:capitalize">${body.category}</td></tr>
                  <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Value</td><td style="color:#f1f5f9;font-weight:600">${body.label}</td></tr>
                  <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Requested by</td><td style="color:#f1f5f9">${userData.full_name} (${userData.email})</td></tr>
                  ${body.description ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">Description</td><td style="color:#94a3b8">${body.description}</td></tr>` : ''}
                </table>
                <div style="margin-top:20px">
                  <a href="${appUrl}/settings/masters?category=${body.category}&tab=pending"
                    style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
                    Review & Approve →
                  </a>
                </div>
              </div>
            </div>
          `,
        })
      }
    } catch { /* email non-fatal */ }
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()
  const { id, action, label, description, is_active, sort_order } = body

  if (action === 'approve' || action === 'reject') {
    if (!['super_admin', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Only admins can approve' }, { status: 403 })
    }
    const { data, error } = await supabase
      .from('masters')
      .update({
        approval_status: action === 'approve' ? 'approved' : 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', userData.organization_id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // General update
  const updates: any = { updated_at: new Date().toISOString() }
  if (label !== undefined) updates.label = label
  if (description !== undefined) updates.description = description
  if (is_active !== undefined) updates.is_active = is_active
  if (sort_order !== undefined) updates.sort_order = sort_order

  const { data, error } = await supabase
    .from('masters')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', userData.organization_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!['super_admin', 'admin'].includes(userData?.role || '')) {
    return NextResponse.json({ error: 'Only admins can delete masters' }, { status: 403 })
  }

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('masters')
    .delete()
    .eq('id', id)
    .eq('organization_id', userData!.organization_id)

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ success: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
