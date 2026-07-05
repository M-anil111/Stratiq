import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ActivityItem = {
  type: string
  label: string
  description: string
  client: string
  created_at: string
  url: string
}

async function safeSelect<T>(fn: () => Promise<{ data: T[] | null; error: any }>): Promise<T[]> {
  try {
    const { data, error } = await fn()
    if (error?.code === '42P01') return []
    if (error) return []
    return data || []
  } catch {
    return []
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const orgId = userData.organization_id

  const [social, offpage, blog, onpage, group, recentClients, recentMessages, recentInvoices] = await Promise.all([
    safeSelect(() =>
      supabase.from('social_media_postings')
        .select('id, platform, created_at, projects(name, clients(company_name))')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5)
    ),
    safeSelect(() =>
      supabase.from('offpage_submissions')
        .select('id, website_url, created_at, projects(name, clients(company_name))')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5)
    ),
    safeSelect(() =>
      supabase.from('blog_submissions')
        .select('id, title, created_at, projects(name, clients(company_name))')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5)
    ),
    safeSelect(() =>
      supabase.from('onpage_details')
        .select('id, url, created_at, projects(name, clients(company_name))')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5)
    ),
    safeSelect(() =>
      supabase.from('group_postings')
        .select('id, platform, created_at, projects(name, clients(company_name))')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5)
    ),
    safeSelect(() =>
      supabase.from('clients')
        .select('id, company_name, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(10)
    ),
    safeSelect(() =>
      supabase.from('messages')
        .select('id, subject, body, created_at, client_id')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5)
    ),
    safeSelect(() =>
      supabase.from('invoices')
        .select('id, invoice_number, total, amount, status, created_at, client_id')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5)
    ),
  ])

  const items: ActivityItem[] = [
    ...social.map((r: any) => ({
      type: 'social',
      label: `Social post on ${r.platform}`,
      description: `Social post on ${r.platform}`,
      client: r.projects?.clients?.company_name || '',
      created_at: r.created_at,
      url: '/targets',
    })),
    ...offpage.map((r: any) => ({
      type: 'offpage',
      label: `Off-page link: ${r.website_url}`,
      description: `Off-page link: ${r.website_url}`,
      client: r.projects?.clients?.company_name || '',
      created_at: r.created_at,
      url: '/targets',
    })),
    ...blog.map((r: any) => ({
      type: 'blog',
      label: `Blog post: ${r.title}`,
      description: `Blog post: ${r.title}`,
      client: r.projects?.clients?.company_name || '',
      created_at: r.created_at,
      url: '/targets',
    })),
    ...onpage.map((r: any) => ({
      type: 'onpage',
      label: `OnPage: ${r.url}`,
      description: `OnPage: ${r.url}`,
      client: r.projects?.clients?.company_name || '',
      created_at: r.created_at,
      url: '/targets',
    })),
    ...group.map((r: any) => ({
      type: 'group',
      label: `Group post on ${r.platform}`,
      description: `Group post on ${r.platform}`,
      client: r.projects?.clients?.company_name || '',
      created_at: r.created_at,
      url: '/targets',
    })),
    ...recentClients.map((r: any) => ({
      type: 'client',
      label: `New client: ${r.company_name}`,
      description: `New client added: ${r.company_name}`,
      client: r.company_name,
      created_at: r.created_at,
      url: `/clients/${r.id}`,
    })),
    ...recentMessages.map((r: any) => {
      const preview = r.subject || (r.body ? String(r.body).slice(0, 60) : 'New message')
      return {
        type: 'message',
        label: preview,
        description: preview,
        client: '',
        created_at: r.created_at,
        url: r.client_id ? `/clients/${r.client_id}` : '/clients',
      }
    }),
    ...recentInvoices.map((r: any) => {
      const num = r.invoice_number || r.id?.slice(0, 8)
      const amt = parseFloat(r.total || r.amount || 0)
      const label = `Invoice #${num}${amt ? `: $${amt.toLocaleString()}` : ''} (${r.status})`
      return {
        type: 'invoice',
        label,
        description: label,
        client: '',
        created_at: r.created_at,
        url: r.client_id ? `/clients/${r.client_id}` : '/invoices',
      }
    }),
  ]

  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json(items.slice(0, 20))
}
