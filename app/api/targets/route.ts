import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const month = request.nextUrl.searchParams.get('month') || currentMonth()
  const [year, mo] = month.split('-').map(Number)
  const startDate = `${month}-01`
  const endDate = new Date(year, mo, 0).toISOString().split('T')[0] // last day of month

  // Get team members
  const { data: members, error: membersError } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')
    .eq('organization_id', userData.organization_id)

  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })

  // Try to get targets — graceful fallback if table doesn't exist
  let targetsMap: Record<string, { social_target: number; offpage_target: number; blog_target: number }> = {}
  try {
    const { data: targets } = await supabase
      .from('activity_targets')
      .select('user_id, social_target, offpage_target, blog_target')
      .eq('organization_id', userData.organization_id)
      .eq('month', month)
    if (targets) {
      for (const t of targets) {
        targetsMap[t.user_id] = { social_target: t.social_target || 0, offpage_target: t.offpage_target || 0, blog_target: t.blog_target || 0 }
      }
    }
  } catch {}

  // Get actuals
  const [socialRes, offpageRes, blogRes] = await Promise.all([
    supabase.from('social_media_postings')
      .select('assigned_user_id')
      .eq('organization_id', userData.organization_id)
      .gte('submission_date', startDate)
      .lte('submission_date', endDate),
    supabase.from('offpage_submissions')
      .select('assigned_user_id')
      .eq('organization_id', userData.organization_id)
      .gte('submission_date', startDate)
      .lte('submission_date', endDate),
    supabase.from('blog_submissions')
      .select('assigned_user_id')
      .eq('organization_id', userData.organization_id)
      .gte('submission_date', startDate)
      .lte('submission_date', endDate),
  ])

  function countByUser(rows: any[] | null) {
    const counts: Record<string, number> = {}
    for (const row of rows || []) {
      if (row.assigned_user_id) counts[row.assigned_user_id] = (counts[row.assigned_user_id] || 0) + 1
    }
    return counts
  }

  const socialCounts = countByUser(socialRes.data)
  const offpageCounts = countByUser(offpageRes.data)
  const blogCounts = countByUser(blogRes.data)

  const result = (members || []).map(m => {
    const initials = (m.full_name || '')
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    const t = targetsMap[m.id] || { social_target: 0, offpage_target: 0, blog_target: 0 }
    return {
      user_id: m.id,
      full_name: m.full_name,
      avatar_url: m.avatar_url,
      avatar_initials: initials,
      targets: { social: t.social_target, offpage: t.offpage_target, blog: t.blog_target },
      actuals: { social: socialCounts[m.id] || 0, offpage: offpageCounts[m.id] || 0, blog: blogCounts[m.id] || 0 },
    }
  })

  return NextResponse.json(result)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { user_id, social_target, offpage_target, blog_target, month } = await request.json()

  const { data, error } = await supabase
    .from('activity_targets')
    .upsert({
      user_id,
      organization_id: userData.organization_id,
      month: month || currentMonth(),
      social_target: social_target || 0,
      offpage_target: offpage_target || 0,
      blog_target: blog_target || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,month' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
