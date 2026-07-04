import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const orgId = userData.organization_id

  const [social, offpage, blog, onpage, group] = await Promise.all([
    supabase.from('social_media_postings')
      .select('id, platform, created_at, projects(name, clients(company_name))')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('offpage_submissions')
      .select('id, website_url, created_at, projects(name, clients(company_name))')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('blog_submissions')
      .select('id, title, created_at, projects(name, clients(company_name))')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('onpage_details')
      .select('id, url, created_at, projects(name, clients(company_name))')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('group_postings')
      .select('id, platform, created_at, projects(name, clients(company_name))')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const items = [
    ...(social.data || []).map(r => ({
      type: 'social',
      label: `Social post on ${r.platform}`,
      client: (r.projects as any)?.clients?.company_name || '',
      created_at: r.created_at,
    })),
    ...(offpage.data || []).map(r => ({
      type: 'offpage',
      label: `Off-page link: ${r.website_url}`,
      client: (r.projects as any)?.clients?.company_name || '',
      created_at: r.created_at,
    })),
    ...(blog.data || []).map(r => ({
      type: 'blog',
      label: `Blog post: ${r.title}`,
      client: (r.projects as any)?.clients?.company_name || '',
      created_at: r.created_at,
    })),
    ...(onpage.data || []).map(r => ({
      type: 'onpage',
      label: `OnPage: ${r.url}`,
      client: (r.projects as any)?.clients?.company_name || '',
      created_at: r.created_at,
    })),
    ...(group.data || []).map(r => ({
      type: 'group',
      label: `Group post on ${r.platform}`,
      client: (r.projects as any)?.clients?.company_name || '',
      created_at: r.created_at,
    })),
  ]

  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json(items.slice(0, 15))
}
