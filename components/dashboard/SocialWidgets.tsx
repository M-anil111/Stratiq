'use client'
import Link from 'next/link'
import {
  AlertTriangle, Clock3, CalendarDays, CalendarClock, Send, ArrowRight,
} from 'lucide-react'

export interface SocialPosting {
  id: string
  platform?: string
  post_content?: string
  failed_reason?: string
  scheduled_date?: string
  created_at?: string
}

export interface PublishedPost {
  id: string
  platform?: string
  permalink?: string
  content_snippet?: string
  published_at?: string
}

export interface SocialData {
  social_failed_count?: number
  social_failed_posts?: SocialPosting[]
  social_awaiting_approval_count?: number
  social_awaiting_approval?: SocialPosting[]
  social_scheduled_today_count?: number
  social_scheduled_today?: SocialPosting[]
  social_scheduled_week_count?: number
  social_scheduled_week?: SocialPosting[]
  social_recently_published?: PublishedPost[]
}

function fmtTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function snippet(text?: string, fallback = 'Untitled post') {
  if (!text) return fallback
  const t = text.trim()
  return t.length > 64 ? t.slice(0, 64) + '…' : t
}

function PlatformTag({ platform }: { platform?: string }) {
  if (!platform) return null
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border border-white/[0.1] bg-white/[0.05] text-slate-400 shrink-0">
      {platform}
    </span>
  )
}

// --- Count + list widget for failed / awaiting / scheduled ---
function CountListWidget({
  title, count, items, icon: Icon, accent, emptyText,
}: {
  title: string
  count: number
  items: SocialPosting[]
  icon: React.ElementType
  accent: string
  emptyText: string
}) {
  return (
    <div className="glass-card p-5 h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border ${accent}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-white leading-tight">{count}</p>
          </div>
        </div>
        <Link href="/social" className="text-slate-600 hover:text-slate-300 transition-colors">
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-600 mt-auto">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {items.slice(0, 5).map(item => (
            <Link key={item.id} href="/social"
              className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-white/[0.04] transition-colors group">
              <PlatformTag platform={item.platform} />
              <span className="text-sm text-slate-300 flex-1 truncate">{snippet(item.post_content)}</span>
              <span className="text-[11px] text-slate-600 shrink-0">{fmtTime(item.scheduled_date || item.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function FailedPostsWidget({ data }: { data: SocialData }) {
  return (
    <CountListWidget
      title="Failed posts"
      count={data.social_failed_count ?? 0}
      items={data.social_failed_posts || []}
      icon={AlertTriangle}
      accent="text-rose-400 bg-rose-500/10 border-rose-500/20"
      emptyText="No failed posts. All good."
    />
  )
}

export function AwaitingApprovalWidget({ data }: { data: SocialData }) {
  return (
    <CountListWidget
      title="Awaiting approval"
      count={data.social_awaiting_approval_count ?? 0}
      items={data.social_awaiting_approval || []}
      icon={Clock3}
      accent="text-amber-400 bg-amber-500/10 border-amber-500/20"
      emptyText="Nothing awaiting approval."
    />
  )
}

export function ScheduledTodayWidget({ data }: { data: SocialData }) {
  return (
    <CountListWidget
      title="Scheduled today"
      count={data.social_scheduled_today_count ?? 0}
      items={data.social_scheduled_today || []}
      icon={CalendarDays}
      accent="text-sky-400 bg-sky-500/10 border-sky-500/20"
      emptyText="Nothing scheduled for today."
    />
  )
}

export function ScheduledWeekWidget({ data }: { data: SocialData }) {
  return (
    <CountListWidget
      title="Scheduled this week"
      count={data.social_scheduled_week_count ?? 0}
      items={data.social_scheduled_week || []}
      icon={CalendarClock}
      accent="text-violet-400 bg-violet-500/10 border-violet-500/20"
      emptyText="Nothing scheduled this week."
    />
  )
}

export function RecentlyPublishedWidget({ data }: { data: SocialData }) {
  const items = data.social_recently_published || []
  return (
    <div className="glass-card p-5 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
          <Send className="h-4 w-4" />
        </div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider flex-1">Recently published</p>
        <Link href="/social" className="text-xs text-sky-400 hover:text-sky-300 transition-colors shrink-0">View all →</Link>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-600 mt-auto">No published posts yet.</p>
      ) : (
        <div className="space-y-1.5">
          {items.slice(0, 5).map(item => {
            const inner = (
              <>
                <PlatformTag platform={item.platform} />
                <span className="text-sm text-slate-300 flex-1 truncate">{snippet(item.content_snippet, 'Published post')}</span>
                <span className="text-[11px] text-slate-600 shrink-0">{fmtTime(item.published_at)}</span>
              </>
            )
            return item.permalink ? (
              <a key={item.id} href={item.permalink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-white/[0.04] transition-colors">
                {inner}
              </a>
            ) : (
              <div key={item.id} className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg">
                {inner}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
