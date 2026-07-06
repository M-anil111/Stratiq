import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function safeQuery<T>(fn: () => PromiseLike<{ data?: T | null; count?: number | null; error: any }>): Promise<{ data: T | null; count: number }> {
  try {
    const res = await fn()
    if (res.error?.code === '42P01') return { data: null, count: 0 }
    if (res.error) return { data: null, count: 0 }
    return { data: (res.data ?? null) as T | null, count: res.count ?? 0 }
  } catch {
    return { data: null, count: 0 }
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const orgId = userData.organization_id
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  // Social scheduling windows (org-local / server-local is acceptable).
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString()
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59).toISOString()

  const [
    clientsRes, activeClientsRes, clientsMrrRes,
    projectsRes, socialRes, offpageRes, blogRes, onpageRes, groupRes,
    targetsRes,
    invoicesOutstandingRes, invoicesPaidRes, invoicesMonthRes,
    failedPostsRes, failedPostsListRes, awaitingApprovalRes,
    scheduledTodayRes, scheduledWeekRes, recentlyPublishedRes,
  ] = await Promise.all([
    safeQuery(() => supabase.from('clients').select('id', { count: 'exact', head: true }).eq('organization_id', orgId)),
    safeQuery(() => supabase.from('clients').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('project_status', 'active')),
    safeQuery<{ service_packages: any[] }[]>(() => supabase.from('clients').select('service_packages').eq('organization_id', orgId)),
    safeQuery(() => supabase.from('projects').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active')),
    safeQuery(() => supabase.from('social_media_postings').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('submission_date', monthStart).lte('submission_date', monthEnd)),
    safeQuery(() => supabase.from('offpage_submissions').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('submission_date', monthStart).lte('submission_date', monthEnd)),
    safeQuery(() => supabase.from('blog_submissions').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('submission_date', monthStart).lte('submission_date', monthEnd)),
    safeQuery(() => supabase.from('onpage_details').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('created_at', monthStart).lte('created_at', monthEnd)),
    safeQuery(() => supabase.from('group_postings').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('submission_date', monthStart).lte('submission_date', monthEnd)),
    safeQuery<{ social_target: number; offpage_target: number; blog_target: number }[]>(() => supabase.from('activity_targets').select('social_target,offpage_target,blog_target').eq('organization_id', orgId).eq('month', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)),
    safeQuery<{ amount: number }[]>(() => supabase.from('invoices').select('amount').eq('organization_id', orgId).in('status', ['sent', 'overdue'])),
    safeQuery<{ amount: number }[]>(() => supabase.from('invoices').select('amount').eq('organization_id', orgId).eq('status', 'paid').gte('paid_at', monthStart).lte('paid_at', monthEnd)),
    safeQuery<{ total: number; amount_paid: number; status: string }[]>(() => supabase.from('invoices').select('total, amount_paid, status').eq('organization_id', orgId).gte('issue_date', monthStart.slice(0, 10)).lte('issue_date', monthEnd.slice(0, 10))),
    // ---- Social suite widgets ----
    safeQuery(() => supabase.from('social_media_postings').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'failed')),
    safeQuery<{ id: string; platform: string; post_content: string; failed_reason: string; scheduled_date: string; created_at: string }[]>(() => supabase.from('social_media_postings').select('id, platform, post_content, failed_reason, scheduled_date, created_at').eq('organization_id', orgId).eq('status', 'failed').order('created_at', { ascending: false }).limit(5)),
    safeQuery<{ id: string; platform: string; post_content: string; scheduled_date: string; created_at: string }[]>(() => supabase.from('social_media_postings').select('id, platform, post_content, scheduled_date, created_at').eq('organization_id', orgId).eq('status', 'pending_approval').order('created_at', { ascending: false }).limit(5)),
    safeQuery<{ id: string; platform: string; post_content: string; scheduled_date: string }[]>(() => supabase.from('social_media_postings').select('id, platform, post_content, scheduled_date').eq('organization_id', orgId).eq('status', 'scheduled').gte('scheduled_date', dayStart).lte('scheduled_date', dayEnd).order('scheduled_date', { ascending: true }).limit(10)),
    safeQuery<{ id: string; platform: string; post_content: string; scheduled_date: string }[]>(() => supabase.from('social_media_postings').select('id, platform, post_content, scheduled_date').eq('organization_id', orgId).eq('status', 'scheduled').gte('scheduled_date', dayStart).lte('scheduled_date', weekEnd).order('scheduled_date', { ascending: true }).limit(50)),
    safeQuery<{ id: string; platform: string; permalink: string; content_snippet: string; published_at: string }[]>(() => supabase.from('social_published_posts').select('id, platform, permalink, content_snippet, published_at').eq('organization_id', orgId).order('published_at', { ascending: false }).limit(5)),
  ])

  const totalActivities = socialRes.count + offpageRes.count + blogRes.count + onpageRes.count + groupRes.count

  let targetsHitPct = 0
  if (targetsRes.data?.length) {
    const targets = targetsRes.data
    const totalTarget = targets.reduce((s, t) => s + (t.social_target || 0) + (t.offpage_target || 0) + (t.blog_target || 0), 0)
    if (totalTarget > 0) {
      targetsHitPct = Math.round(Math.min((totalActivities / totalTarget) * 100, 100))
    }
  }

  // total_mrr: sum all service_packages prices across clients
  const total_mrr = (clientsMrrRes.data || []).reduce((sum, client) => {
    const pkgs: any[] = (client as any).service_packages || []
    return sum + pkgs.reduce((s: number, p: any) => s + (parseFloat(p.price) || 0), 0)
  }, 0)

  // invoices_outstanding: sum of amount from invoices where status in ('sent','overdue')
  const invoices_outstanding = (invoicesOutstandingRes.data || []).reduce((s, i) => s + (parseFloat(String((i as any).amount)) || 0), 0)

  // invoices_paid_this_month: sum of amount from invoices paid this month
  const invoices_paid_this_month = (invoicesPaidRes.data || []).reduce((s, i) => s + (parseFloat(String((i as any).amount)) || 0), 0)

  // Legacy revenue metrics computed from month's invoices
  const invoiceData = invoicesMonthRes.data || []
  const invoice_revenue_this_month = invoiceData.reduce((s, i) => s + (parseFloat(String((i as any).total)) || 0), 0)
  const invoice_outstanding_legacy = invoiceData
    .filter(i => (i as any).status !== 'paid' && (i as any).status !== 'voided')
    .reduce((s, i) => s + Math.max(0, (parseFloat(String((i as any).total)) || 0) - (parseFloat(String((i as any).amount_paid)) || 0)), 0)

  return NextResponse.json({
    total_clients: clientsRes.count,
    active_clients: activeClientsRes.count,
    total_mrr,
    invoices_outstanding: invoices_outstanding || invoice_outstanding_legacy,
    invoices_paid_this_month,
    active_projects: projectsRes.count,
    activities_this_month: totalActivities,
    targets_hit_pct: targetsHitPct,
    invoice_revenue_this_month,
    invoice_outstanding: invoices_outstanding || invoice_outstanding_legacy,
    // ---- Social suite widgets ----
    social_failed_count: failedPostsRes.count,
    social_failed_posts: failedPostsListRes.data || [],
    social_awaiting_approval_count: (awaitingApprovalRes.data || []).length,
    social_awaiting_approval: awaitingApprovalRes.data || [],
    social_scheduled_today_count: (scheduledTodayRes.data || []).length,
    social_scheduled_today: scheduledTodayRes.data || [],
    social_scheduled_week_count: (scheduledWeekRes.data || []).length,
    social_scheduled_week: scheduledWeekRes.data || [],
    social_recently_published: recentlyPublishedRes.data || [],
  })
}
