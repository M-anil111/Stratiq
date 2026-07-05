import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - list unread notifications for the user
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error?.code === '42P01') return NextResponse.json({ notifications: [], unread_count: 0 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    notifications: data || [],
    unread_count: (data || []).length
  })
}

// PATCH - mark notification(s) as read
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { id, mark_all_read } = body

  if (mark_all_read) {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id)
  } else if (id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', user.id)
  }

  return NextResponse.json({ success: true })
}
