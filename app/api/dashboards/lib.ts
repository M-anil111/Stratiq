import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type DashboardWidget = {
  id: string
  type: string
  title: string
  config: Record<string, any>
}

export const WIDGET_TYPES = [
  'stats_tile',
  'activity_feed',
  'top_clients',
  'tasks_due',
  'leads_pipeline',
  'invoice_status',
] as const

export const ACCESS_LEVELS = ['private', 'everyone_view', 'everyone_edit'] as const

export const FAVORITE_LIMIT = 10
export const RESTORE_WINDOW_DAYS = 14

export type DashboardContext = {
  supabase: SupabaseClient<any, any, any>
  user: { id: string } | null
  organizationId: string | null
  role: string | null
  isAdmin: boolean
}

export async function getDashboardContext(): Promise<DashboardContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, organizationId: null, role: null, isAdmin: false }

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  const role = userData?.role || null
  return {
    supabase,
    user,
    organizationId: userData?.organization_id || null,
    role,
    isAdmin: role === 'admin' || role === 'super_admin',
  }
}

/**
 * HubSpot dashboard name rule: non-empty, no URLs, no periods.
 * Returns an error message, or null if the name is valid.
 */
export function validateDashboardName(name: unknown): string | null {
  const trimmed = String(name ?? '').trim()
  if (!trimmed) return 'Name is required'
  if (trimmed.length > 100) return 'Name must be 100 characters or fewer'
  if (trimmed.includes('.')) return 'Name cannot contain periods'
  if (/https?:\/\/|www\./i.test(trimmed)) return 'Name cannot contain URLs'
  return null
}

export function makeWidget(type: string, title: string, config: Record<string, any> = {}): DashboardWidget {
  return { id: randomUUID(), type, title, config }
}

/** Widgets that make up each creation template. */
export function templateWidgets(template: string): DashboardWidget[] {
  switch (template) {
    case 'marketing':
      return [
        makeWidget('stats_tile', 'Total MRR', { metric: 'total_mrr' }),
        makeWidget('activity_feed', 'Recent Activity'),
        makeWidget('leads_pipeline', 'Leads Pipeline'),
      ]
    case 'service':
      return [
        makeWidget('tasks_due', 'Overdue Tasks'),
        makeWidget('activity_feed', 'Recent Activity'),
        makeWidget('top_clients', 'Top Clients by MRR'),
      ]
    case 'billing':
      return [
        makeWidget('stats_tile', 'Invoices Outstanding', { metric: 'invoices_outstanding' }),
        makeWidget('stats_tile', 'Paid This Month', { metric: 'invoices_paid_this_month' }),
        makeWidget('invoice_status', 'Invoices by Status'),
      ]
    case 'blank':
    default:
      return []
  }
}

/** Validate and normalize a widgets payload from the client. */
export function sanitizeWidgets(input: unknown): DashboardWidget[] | null {
  if (!Array.isArray(input)) return null
  const widgets: DashboardWidget[] = []
  for (const w of input) {
    if (!w || typeof w !== 'object') return null
    const type = String((w as any).type || '')
    if (!(WIDGET_TYPES as readonly string[]).includes(type)) return null
    widgets.push({
      id: String((w as any).id || randomUUID()),
      type,
      title: String((w as any).title || '').slice(0, 100) || 'Untitled widget',
      config: (w as any).config && typeof (w as any).config === 'object' ? (w as any).config : {},
    })
  }
  return widgets
}

export function canViewDashboard(dashboard: { access: string; owner_id: string | null }, userId: string, isAdmin: boolean): boolean {
  if (dashboard.access !== 'private') return true
  return isAdmin || dashboard.owner_id === userId
}

export function canEditWidgets(dashboard: { access: string; owner_id: string | null }, userId: string, isAdmin: boolean): boolean {
  if (isAdmin || dashboard.owner_id === userId) return true
  return dashboard.access === 'everyone_edit'
}

export function canManageDashboard(dashboard: { owner_id: string | null }, userId: string, isAdmin: boolean): boolean {
  return isAdmin || dashboard.owner_id === userId
}

/** Best-effort activity log — never fails the parent mutation. */
export async function logDashboardActivity(
  supabase: SupabaseClient<any, any, any>,
  organizationId: string,
  dashboardId: string,
  userId: string,
  action: string,
  detail: string
): Promise<void> {
  try {
    await supabase.from('dashboard_activity').insert({
      organization_id: organizationId,
      dashboard_id: dashboardId,
      user_id: userId,
      action,
      detail,
    })
  } catch {
    // ignore — activity logging must never break the mutation
  }
}

export function defaultDashboardKey(userId: string): string {
  return `default_dashboard_${userId}`
}
