'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Users, FolderOpen, Activity, TrendingUp, Plus, ArrowRight,
  Sparkles, GripVertical, Search, X, DollarSign, AlertCircle,
} from 'lucide-react'
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
  active_projects: number
  activities_this_month: number
  targets_hit_pct: number
  invoice_revenue_this_month?: number
  invoice_outstanding?: number
}

interface ActivityItem {
  type: string
  label: string
  client: string
  created_at: string
}

const typeBadge: Record<string, { label: string; color: string }> = {
  social:  { label: 'Social',    color: 'rgba(14,165,233,0.15) border-[rgba(14,165,233,0.3)] text-sky-300' },
  offpage: { label: 'Off-Page',  color: 'rgba(16,185,129,0.15) border-[rgba(16,185,129,0.3)] text-emerald-300' },
  blog:    { label: 'Blog',      color: 'rgba(245,158,11,0.15) border-[rgba(245,158,11,0.3)] text-amber-300' },
  onpage:  { label: 'OnPage',    color: 'rgba(139,92,246,0.15) border-[rgba(139,92,246,0.3)] text-violet-300' },
  group:   { label: 'Group',     color: 'rgba(236,72,153,0.15) border-[rgba(236,72,153,0.3)] text-pink-300' },
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

const SECTION_IDS = ['kpi', 'quick-actions', 'activity']
const SECTION_STORAGE_KEY = 'dashboard_section_order'

function loadOrder(): string[] {
  if (typeof window === 'undefined') return SECTION_IDS
  try {
    const saved = localStorage.getItem(SECTION_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      // Ensure all sections are present (handle new sections added later)
      const missing = SECTION_IDS.filter(id => !parsed.includes(id))
      return [...parsed.filter((id: string) => SECTION_IDS.includes(id)), ...missing]
    }
  } catch { /* ignore */ }
  return SECTION_IDS
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [sectionOrder, setSectionOrder] = useState<string[]>(SECTION_IDS)
  const [search, setSearch] = useState('')
  const [searchFocus, setSearchFocus] = useState(false)

  useEffect(() => {
    setSectionOrder(loadOrder())
    fetch('/api/dashboard/stats').then(r => r.json()).then(setStats)
    fetch('/api/dashboard/activity')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setActivity(data) })
      .finally(() => setActivityLoading(false))
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setSectionOrder(prev => {
        const next = arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id)))
        localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next))
        return next
      })
    }
  }, [])

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
    {
      label: 'Revenue This Month', value: stats?.invoice_revenue_this_month != null ? `$${stats.invoice_revenue_this_month.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : null,
      icon: DollarSign, href: '/invoices',
      gradient: 'from-emerald-500/20 to-teal-600/10', iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/15 border-emerald-500/20',
    },
    {
      label: 'Outstanding', value: stats?.invoice_outstanding != null ? `$${stats.invoice_outstanding.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : null,
      icon: AlertCircle, href: '/invoices',
      gradient: 'from-amber-500/20 to-orange-600/10', iconColor: 'text-amber-400', iconBg: 'bg-amber-500/15 border-amber-500/20',
    },
  ]

  const filteredActivity = search
    ? activity.filter(a =>
        a.label.toLowerCase().includes(search.toLowerCase()) ||
        a.client?.toLowerCase().includes(search.toLowerCase()) ||
        a.type?.toLowerCase().includes(search.toLowerCase())
      )
    : activity

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
                {card.value
                  ? <p className="text-2xl font-bold text-white">{card.value}</p>
                  : <div className="skeleton h-8 w-16 mt-1" />
                }
              </div>
            </Link>
          ))}
        </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { href: '/clients/new', title: 'Add Client', sub: 'Onboard a new client' },
            { href: '/reports', title: 'View Reports', sub: 'Marketing performance' },
            { href: '/targets', title: 'Track Targets', sub: 'Team KPI dashboard' },
          ].map(({ href, title, sub }) => (
            <Link key={href} href={href}
              className="glass-card p-4 flex items-center justify-between group">
              <div>
                <p className="font-semibold text-white text-sm">{title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-sky-400 group-hover:translate-x-1 transition-all duration-200" />
            </Link>
          ))}
        </div>
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
                <div className="skeleton h-5 w-16" />
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
            {filteredActivity.map((item, i) => {
              const badge = typeBadge[item.type]
              return (
                <div key={i}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/[0.04] transition-colors duration-150 group">
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
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Drag the <GripVertical className="h-3 w-3 inline text-slate-600" /> handles to rearrange sections
          </p>
        </div>
        <Link href="/clients/new" className="btn-brand flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Client</span>
        </Link>
      </div>

      {/* Draggable sections */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-8">
            {sectionOrder.map(id => (
              <SortableSection key={id} id={id}>
                {(handle) => sections[id]?.(handle)}
              </SortableSection>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
