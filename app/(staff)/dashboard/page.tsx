'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Users, FolderOpen, Activity, TrendingUp, Plus, ArrowRight,
  Sparkles, GripVertical, Search, X, DollarSign, AlertCircle,
  CheckCircle, FileText, BarChart2, Clock,
  ChevronUp, ChevronDown, EyeOff, Settings2, Check,
} from 'lucide-react'
import {
  FailedPostsWidget, AwaitingApprovalWidget, ScheduledTodayWidget,
  ScheduledWeekWidget, RecentlyPublishedWidget, SocialData,
} from '@/components/dashboard/SocialWidgets'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Stats {
  total_clients: number
  active_clients: number
  total_mrr: number
  invoices_outstanding: number
  invoices_paid_this_month: number
  active_projects: number
  activities_this_month: number
  targets_hit_pct: number
  invoice_revenue_this_month?: number
  invoice_outstanding?: number
}

type StatsWithSocial = Stats & SocialData

interface ActivityItem {
  type: string
  label: string
  client: string
  created_at: string
}

interface ClientItem {
  id: string
  company_name: string
  service_packages?: { price?: number | string }[]
  active_project_count?: number
}

const typeBadge: Record<string, { label: string; color: string }> = {
  social:  { label: 'Social',    color: 'rgba(14,165,233,0.15) border-[rgba(14,165,233,0.3)] text-sky-300' },
  offpage: { label: 'Off-Page',  color: 'rgba(16,185,129,0.15) border-[rgba(16,185,129,0.3)] text-emerald-300' },
  blog:    { label: 'Blog',      color: 'rgba(245,158,11,0.15) border-[rgba(245,158,11,0.3)] text-amber-300' },
  onpage:  { label: 'OnPage',    color: 'rgba(139,92,246,0.15) border-[rgba(139,92,246,0.3)] text-violet-300' },
  group:   { label: 'Group',     color: 'rgba(236,72,153,0.15) border-[rgba(236,72,153,0.3)] text-pink-300' },
}

const activityTypeIcon: Record<string, React.ElementType> = {
  social: Activity,
  offpage: FolderOpen,
  blog: FileText,
  onpage: TrendingUp,
  group: Users,
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtCurrency(val: number) {
  return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function clientMrr(client: ClientItem): number {
  return (client.service_packages || []).reduce((s, p) => s + (parseFloat(String(p.price || 0)) || 0), 0)
}

// --- Sortable section wrapper ---
function SortableSection({ id, children }: { id: string; children: (handleProps: any) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners })}
    </div>
  )
}

// Ordered widget keys. Social widgets (migration 040) join the grid.
const DEFAULT_ORDER = [
  'kpi', 'dashboard-stats',
  'social-failed', 'social-awaiting', 'social-scheduled-today',
  'social-scheduled-week', 'social-recently-published',
  'quick-actions', 'top-clients', 'activity',
]

const WIDGET_META: Record<string, string> = {
  kpi: 'Overview',
  'dashboard-stats': 'Billing & Clients',
  'social-failed': 'Failed posts',
  'social-awaiting': 'Awaiting approval',
  'social-scheduled-today': 'Scheduled today',
  'social-scheduled-week': 'Scheduled this week',
  'social-recently-published': 'Recently published',
  'quick-actions': 'Quick Actions',
  'top-clients': 'Top Clients',
  activity: 'Recent Activity',
}

function reconcileOrder(order: string[]): string[] {
  const known = order.filter(id => DEFAULT_ORDER.includes(id))
  const missing = DEFAULT_ORDER.filter(id => !known.includes(id))
  return [...known, ...missing]
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsWithSocial | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [clients, setClients] = useState<ClientItem[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_ORDER)
  const [hidden, setHidden] = useState<string[]>([])
  const [editMode, setEditMode] = useState(false)
  const [layoutReady, setLayoutReady] = useState(false)
  const [search, setSearch] = useState('')
  const [searchFocus, setSearchFocus] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/layout')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data?.order)) setSectionOrder(reconcileOrder(data.order))
        if (Array.isArray(data?.hidden)) setHidden(data.hidden.filter((id: string) => DEFAULT_ORDER.includes(id)))
      })
      .catch(() => {})
      .finally(() => setLayoutReady(true))
    fetch('/api/dashboard/stats').then(r => r.json()).then(setStats)
    fetch('/api/dashboard/activity')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setActivity(data) })
      .finally(() => setActivityLoading(false))
    fetch('/api/clients?limit=100')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data?.clients)) setClients(data.clients) })
      .finally(() => setClientsLoading(false))
    fetch('/api/me')
      .then(r => r.json())
      .then(data => {
        if (data?.full_name) {
          setUserName(data.full_name.split(' ')[0])
        }
      })
      .catch(() => {})
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const persistLayout = useCallback((order: string[], hiddenIds: string[]) => {
    fetch('/api/dashboard/layout', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order, hidden: hiddenIds }),
    }).catch(() => {})
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setSectionOrder(prev => {
        const next = arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id)))
        persistLayout(next, hidden)
        return next
      })
    }
  }, [hidden, persistLayout])

  const moveSection = useCallback((id: string, dir: -1 | 1) => {
    setSectionOrder(prev => {
      const visible = prev.filter(s => !hidden.includes(s))
      const vi = visible.indexOf(id)
      const target = vi + dir
      if (vi < 0 || target < 0 || target >= visible.length) return prev
      // swap positions within the full order array
      const fromIdx = prev.indexOf(id)
      const toIdx = prev.indexOf(visible[target])
      const next = arrayMove(prev, fromIdx, toIdx)
      persistLayout(next, hidden)
      return next
    })
  }, [hidden, persistLayout])

  const toggleHidden = useCallback((id: string) => {
    setHidden(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      persistLayout(sectionOrder, next)
      return next
    })
  }, [sectionOrder, persistLayout])

  const kpiCards = [
    {
      label: 'Total Clients', value: stats ? String(stats.total_clients) : null,
      icon: Users, href: '/clients',
      gradient: 'from-sky-500/20 to-sky-600/10', iconColor: 'text-sky-400', iconBg: 'bg-sky-500/15 border-sky-500/20',
    },
    {
      label: 'Active Projects', value: stats ? String(stats.active_projects) : null,
      icon: FolderOpen, href: '/clients',
      gradient: 'from-emerald-500/20 to-emerald-600/10', iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/15 border-emerald-500/20',
    },
    {
      label: 'Activities This Month', value: stats ? String(stats.activities_this_month) : null,
      icon: Activity, href: '/targets',
      gradient: 'from-amber-500/20 to-amber-600/10', iconColor: 'text-amber-400', iconBg: 'bg-amber-500/15 border-amber-500/20',
    },
    {
      label: 'Targets Hit', value: stats ? `${stats.targets_hit_pct}%` : null,
      icon: TrendingUp, href: '/targets',
      gradient: 'from-violet-500/20 to-violet-600/10', iconColor: 'text-violet-400', iconBg: 'bg-violet-500/15 border-violet-500/20',
    },
  ]

  // The 4 required stats from /api/dashboard/stats
  const dashboardStatCards = [
    {
      label: 'Active Clients', value: stats ? String(stats.active_clients) : null,
      icon: Users, href: '/clients',
      gradient: 'from-sky-500/20 to-sky-600/10', iconColor: 'text-sky-400', iconBg: 'bg-sky-500/15 border-sky-500/20',
    },
    {
      label: 'Total MRR', value: stats ? fmtCurrency(stats.total_mrr) : null,
      icon: DollarSign, href: '/invoices',
      gradient: 'from-emerald-500/20 to-teal-600/10', iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/15 border-emerald-500/20',
    },
    {
      label: 'Invoices Outstanding', value: stats ? fmtCurrency(stats.invoices_outstanding) : null,
      icon: AlertCircle, href: '/invoices',
      gradient: 'from-amber-500/20 to-orange-600/10', iconColor: 'text-amber-400', iconBg: 'bg-amber-500/15 border-amber-500/20',
    },
    {
      label: 'Paid This Month', value: stats ? fmtCurrency(stats.invoices_paid_this_month) : null,
      icon: CheckCircle, href: '/invoices',
      gradient: 'from-violet-500/20 to-purple-600/10', iconColor: 'text-violet-400', iconBg: 'bg-violet-500/15 border-violet-500/20',
    },
  ]

  const filteredActivity = search
    ? activity.filter(a =>
        a.label.toLowerCase().includes(search.toLowerCase()) ||
        a.client?.toLowerCase().includes(search.toLowerCase()) ||
        a.type?.toLowerCase().includes(search.toLowerCase())
      )
    : activity

  const topClients = [...clients]
    .sort((a, b) => clientMrr(b) - clientMrr(a))
    .slice(0, 5)

  const sections: Record<string, (handleProps: any) => React.ReactNode> = {
    kpi: (handle) => (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <button {...handle.listeners} {...handle.attributes}
            className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors touch-none p-1"
            title="Drag to reorder">
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Overview</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card, i) => (
            <Link key={card.label} href={card.href}
              className="glass-card p-5 group animate-float-up"
              style={{ animationDelay: `${i * 75}ms` }}>
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-xl border ${card.iconBg}`}>
                    <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{card.label}</p>
                {card.value != null
                  ? <p className="text-2xl font-bold text-white">{card.value}</p>
                  : <div className="skeleton h-8 w-16 mt-1" />
                }
              </div>
            </Link>
          ))}
        </div>
      </div>
    ),

    'dashboard-stats': (handle) => (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <button {...handle.listeners} {...handle.attributes}
            className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors touch-none p-1"
            title="Drag to reorder">
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Billing &amp; Clients</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {dashboardStatCards.map((card, i) => (
            <Link key={card.label} href={card.href}
              className="glass-card p-5 group animate-float-up"
              style={{ animationDelay: `${i * 75}ms` }}>
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-xl border ${card.iconBg}`}>
                    <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{card.label}</p>
                {card.value != null
                  ? <p className="text-2xl font-bold text-white">{card.value}</p>
                  : <div className="skeleton h-8 w-16 mt-1" />
                }
              </div>
            </Link>
          ))}
        </div>
      </div>
    ),

    'social-failed': (handle) => (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button {...handle.listeners} {...handle.attributes}
            className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors touch-none p-1"
            title="Drag to reorder">
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
        <FailedPostsWidget data={(stats || {}) as SocialData} />
      </div>
    ),

    'social-awaiting': (handle) => (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button {...handle.listeners} {...handle.attributes}
            className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors touch-none p-1"
            title="Drag to reorder">
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
        <AwaitingApprovalWidget data={(stats || {}) as SocialData} />
      </div>
    ),

    'social-scheduled-today': (handle) => (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button {...handle.listeners} {...handle.attributes}
            className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors touch-none p-1"
            title="Drag to reorder">
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
        <ScheduledTodayWidget data={(stats || {}) as SocialData} />
      </div>
    ),

    'social-scheduled-week': (handle) => (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button {...handle.listeners} {...handle.attributes}
            className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors touch-none p-1"
            title="Drag to reorder">
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
        <ScheduledWeekWidget data={(stats || {}) as SocialData} />
      </div>
    ),

    'social-recently-published': (handle) => (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button {...handle.listeners} {...handle.attributes}
            className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors touch-none p-1"
            title="Drag to reorder">
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
        <RecentlyPublishedWidget data={(stats || {}) as SocialData} />
      </div>
    ),

    'quick-actions': (handle) => (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <button {...handle.listeners} {...handle.attributes}
            className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors touch-none p-1"
            title="Drag to reorder">
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Quick Actions</span>
        </div>
        <div className="glass-card p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: '/clients/new', title: 'New Client', sub: 'Onboard a new client', icon: Users, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
              { href: '/invoices', title: 'New Invoice', sub: 'Create & send invoice', icon: FileText, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
              { href: '/clients', title: 'New Project', sub: 'Start a client project', icon: FolderOpen, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
              { href: '/reports/marketing', title: 'View Reports', sub: 'Marketing performance', icon: BarChart2, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
            ].map(({ href, title, sub, icon: Icon, color }) => (
              <Link key={href} href={href}
                className="flex flex-col items-start gap-3 p-4 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/[0.12] transition-all duration-200 group">
                <div className={`p-2 rounded-xl border ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    ),

    'top-clients': (handle) => (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <button {...handle.listeners} {...handle.attributes}
            className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors touch-none p-1"
            title="Drag to reorder">
            <GripVertical className="h-4 w-4" />
          </button>
          <h2 className="font-semibold text-white flex-1">Top Clients by MRR</h2>
          <Link href="/clients" className="text-xs text-sky-400 hover:text-sky-300 transition-colors shrink-0">View all →</Link>
        </div>
        {clientsLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-4 w-6 shrink-0" />
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-4 w-16" />
              </div>
            ))}
          </div>
        ) : topClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-600">
            <Users className="h-8 w-8 opacity-30 mb-2" />
            <p className="text-sm">No clients yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider pb-3 pr-4 w-8">#</th>
                  <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider pb-3 pr-4">Client</th>
                  <th className="text-right text-xs font-semibold text-slate-600 uppercase tracking-wider pb-3 pr-4">MRR</th>
                  <th className="text-right text-xs font-semibold text-slate-600 uppercase tracking-wider pb-3">Active Projects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {topClients.map((client, i) => {
                  const mrr = clientMrr(client)
                  return (
                    <tr key={client.id} className="group hover:bg-white/[0.03] transition-colors duration-150">
                      <td className="py-3 pr-4 text-slate-600 font-medium">{i + 1}</td>
                      <td className="py-3 pr-4">
                        <Link href={`/clients/${client.id}`} className="text-white hover:text-sky-300 transition-colors font-medium">
                          {client.company_name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-emerald-400 font-semibold">{fmtCurrency(mrr)}</span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-slate-400">{client.active_project_count ?? 0}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    ),

    activity: (handle) => (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <button {...handle.listeners} {...handle.attributes}
            className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors touch-none p-1"
            title="Drag to reorder">
            <GripVertical className="h-4 w-4" />
          </button>
          <h2 className="font-semibold text-white flex-1">Recent Activity</h2>
          {/* Search within activity */}
          <div className={`flex items-center gap-2 transition-all duration-200 ${searchFocus || search ? 'w-48' : 'w-8'}`}>
            {(searchFocus || search) ? (
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onBlur={() => { if (!search) setSearchFocus(false) }}
                  placeholder="Filter activity…"
                  className="w-full pl-7 pr-7 py-1.5 text-xs bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ) : (
              <button onClick={() => setSearchFocus(true)} className="text-slate-600 hover:text-slate-300 transition-colors">
                <Search className="h-4 w-4" />
              </button>
            )}
          </div>
          <Link href="/targets" className="text-xs text-sky-400 hover:text-sky-300 transition-colors shrink-0">View all →</Link>
        </div>

        {activityLoading ? (
          <div className="space-y-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-8 w-8 rounded-xl" />
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton h-4 w-12" />
              </div>
            ))}
          </div>
        ) : filteredActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-600">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
              <Activity className="h-6 w-6 opacity-40" />
            </div>
            <p className="text-sm">{search ? 'No matching activity' : 'No activity yet'}</p>
            <p className="text-xs mt-1 text-slate-700">{search ? 'Try a different search term' : 'Add a client and start logging work'}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredActivity.slice(0, 8).map((item, i) => {
              const badge = typeBadge[item.type]
              const IconComp = activityTypeIcon[item.type] || Clock
              return (
                <div key={i}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/[0.04] transition-colors duration-150 group">
                  <div className="p-1.5 rounded-lg bg-white/[0.05] border border-white/[0.07] shrink-0">
                    <IconComp className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border shrink-0"
                    style={{ background: badge ? badge.color.split(' ')[0] : 'rgba(100,100,100,0.15)' }}>
                    {badge?.label || item.type}
                  </span>
                  <span className="text-sm text-slate-300 flex-1 truncate">{item.label}</span>
                  {item.client && (
                    <span className="text-xs text-slate-600 shrink-0 hidden sm:block group-hover:text-slate-500 transition-colors">{item.client}</span>
                  )}
                  <span className="text-xs text-slate-700 shrink-0">{timeAgo(item.created_at)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    ),
  }

  return (
    <div className="p-5 lg:p-8 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-float-up">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-medium text-sky-400 uppercase tracking-widest">Agency Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {getGreeting()}{userName ? `, ${userName}!` : '!'}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {formatDate(new Date())} · {editMode ? 'Add, remove and reorder your widgets' : 'Drag the '}
            {!editMode && <GripVertical className="h-3 w-3 inline text-slate-600" />}
            {!editMode && ' handles to rearrange sections'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode(m => !m)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border transition-colors ${
              editMode
                ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                : 'border-white/[0.1] bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]'
            }`}>
            {editMode ? <Check className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{editMode ? 'Done' : 'Edit dashboard'}</span>
          </button>
          <Link href="/clients/new" className="btn-brand flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Client</span>
          </Link>
        </div>
      </div>

      {/* Widget picker (edit mode): re-add hidden widgets */}
      {editMode && (
        <div className="glass-card p-4 mb-8 animate-float-up">
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="h-4 w-4 text-sky-400" />
            <span className="text-sm font-semibold text-white">Add widgets</span>
          </div>
          {hidden.length === 0 ? (
            <p className="text-xs text-slate-500">All widgets are visible. Use the <EyeOff className="h-3 w-3 inline" /> button on a widget to hide it.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {DEFAULT_ORDER.filter(id => hidden.includes(id)).map(id => (
                <button key={id} onClick={() => toggleHidden(id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/[0.1] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:border-sky-500/30 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  {WIDGET_META[id] || id}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Draggable sections */}
      {(() => {
        const visibleOrder = sectionOrder.filter(id => !hidden.includes(id) && sections[id])
        return (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-8">
                {visibleOrder.map((id, idx) => (
                  <SortableSection key={id} id={id}>
                    {(handle) => (
                      <div>
                        {editMode && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-xs font-semibold text-slate-400 mr-1">{WIDGET_META[id] || id}</span>
                            <button onClick={() => moveSection(id, -1)} disabled={idx === 0}
                              className="p-1 rounded-lg border border-white/[0.1] bg-white/[0.04] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Move up">
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => moveSection(id, 1)} disabled={idx === visibleOrder.length - 1}
                              className="p-1 rounded-lg border border-white/[0.1] bg-white/[0.04] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Move down">
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => toggleHidden(id)}
                              className="flex items-center gap-1 p-1 px-2 rounded-lg border border-white/[0.1] bg-white/[0.04] text-slate-400 hover:text-rose-300 hover:border-rose-500/30 transition-colors"
                              title="Hide widget">
                              <EyeOff className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        {sections[id]?.(handle)}
                      </div>
                    )}
                  </SortableSection>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )
      })()}
    </div>
  )
}
