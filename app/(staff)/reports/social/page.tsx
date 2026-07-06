'use client'
import { useState, useEffect, useMemo } from 'react'
import { ThumbsUp, MessageCircle, Share2, BarChart3, FileText, ExternalLink } from 'lucide-react'

interface Client { id: string; company_name: string }
interface Summary { posts: number; likes: number; comments: number; shares: number; engagement: number }
interface PlatformRow { platform: string; posts: number; likes: number; comments: number; shares: number; engagement: number }
interface MonthRow { month: string; posts: number; engagement: number }
interface TopPost {
  id: string; platform: string; client: string | null; content_preview: string
  likes: number; comments: number; shares: number; engagement: number
  live_link: string | null; scheduled_date: string | null
}
interface ReportData {
  summary: Summary
  by_platform: PlatformRow[]
  by_month: MonthRow[]
  top_posts: TopPost[]
  __unavailable?: boolean
}

const RANGES = [
  { value: 3, label: 'Last 3 months' },
  { value: 6, label: 'Last 6 months' },
  { value: 12, label: 'Last 12 months' },
]

const SORTS = [
  { value: 'engagement', label: 'Most engagement' },
  { value: 'likes', label: 'Most likes' },
  { value: 'comments', label: 'Most comments' },
  { value: 'shares', label: 'Most shares' },
] as const

type SortKey = typeof SORTS[number]['value']

const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  instagram: '#E4405F',
  twitter: '#1DA1F2',
  x: '#0f0f0f',
  linkedin: '#0A66C2',
  youtube: '#FF0000',
  tiktok: '#000000',
  pinterest: '#BD081C',
  threads: '#000000',
  google: '#4285F4',
}

function platformColor(p: string) {
  return PLATFORM_COLORS[(p || '').toLowerCase()] || '#64748b'
}

function labelize(p: string) {
  if (!p) return 'Unknown'
  return p.charAt(0).toUpperCase() + p.slice(1)
}

function fmt(n: number) {
  return (n || 0).toLocaleString()
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

const selectClass = "bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

function PlatformBadge({ platform }: { platform: string }) {
  const color = platformColor(platform)
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: `${color}` }}
    >
      {labelize(platform)}
    </span>
  )
}

function Tile({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-2 text-slate-400">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{fmt(value)}</p>
    </div>
  )
}

export default function SocialAnalyticsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [months, setMonths] = useState(3)
  const [platform, setPlatform] = useState('all')
  const [clientId, setClientId] = useState('all')
  const [sort, setSort] = useState<SortKey>('engagement')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/clients?limit=200').then(r => r.json()).then(d => {
      setClients(d?.clients || (Array.isArray(d) ? d : []))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ months: String(months) })
    if (platform !== 'all') params.set('platform', platform)
    if (clientId !== 'all') params.set('client_id', clientId)
    fetch(`/api/reports/social?${params.toString()}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [months, platform, clientId])

  const platformOptions = useMemo(() => {
    const set = new Set<string>()
    ;(data?.by_platform || []).forEach(p => set.add(p.platform))
    return Array.from(set)
  }, [data])

  const maxMonthEngagement = useMemo(
    () => Math.max(1, ...((data?.by_month || []).map(m => m.engagement))),
    [data]
  )
  const maxPlatformEngagement = useMemo(
    () => Math.max(1, ...((data?.by_platform || []).map(p => p.engagement))),
    [data]
  )

  const sortedTop = useMemo(() => {
    const posts = [...(data?.top_posts || [])]
    return posts.sort((a, b) => (b[sort] as number) - (a[sort] as number))
  }, [data, sort])

  const unavailable = data?.__unavailable === true
  const empty = !unavailable && data && (data.summary?.posts || 0) === 0

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Social Analytics</h1>
        <p className="text-slate-400 text-sm mt-0.5">Published post performance across all platforms</p>
      </div>

      {/* Filter bar */}
      <div className="glass-card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Date range</label>
          <select value={months} onChange={e => setMonths(Number(e.target.value))} className={selectClass}>
            {RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Platform</label>
          <select value={platform} onChange={e => setPlatform(e.target.value)} className={selectClass}>
            <option value="all">All platforms</option>
            {platformOptions.map(p => <option key={p} value={p}>{labelize(p)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Client</label>
          <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${selectClass} min-w-[160px]`}>
            <option value="all">All clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="h-3 w-16 bg-white/10 rounded mb-3" />
                <div className="h-6 w-12 bg-white/10 rounded" />
              </div>
            ))}
          </div>
          <div className="glass-card p-6 animate-pulse h-48" />
          <div className="glass-card p-6 animate-pulse h-64" />
        </div>
      )}

      {!loading && unavailable && (
        <div className="glass-card p-10 text-center text-slate-400">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 text-slate-600" />
          <p className="font-medium text-slate-300">No social data yet — publish posts to see analytics</p>
        </div>
      )}

      {!loading && empty && (
        <div className="glass-card p-10 text-center text-slate-400">
          <FileText className="h-10 w-10 mx-auto mb-3 text-slate-600" />
          <p className="font-medium text-slate-300">No published posts in this range</p>
          <p className="text-sm mt-1">Try widening the date range or clearing filters</p>
        </div>
      )}

      {!loading && data && !unavailable && !empty && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <Tile label="Posts" value={data.summary.posts} icon={FileText} />
            <Tile label="Likes" value={data.summary.likes} icon={ThumbsUp} />
            <Tile label="Comments" value={data.summary.comments} icon={MessageCircle} />
            <Tile label="Shares" value={data.summary.shares} icon={Share2} />
            <Tile label="Engagement" value={data.summary.engagement} icon={BarChart3} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* By platform */}
            <div className="glass-card p-5">
              <h2 className="font-semibold text-white mb-4">By Platform</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="text-left text-slate-500 text-xs uppercase tracking-wide">
                      <th className="pb-2 font-medium">Platform</th>
                      <th className="pb-2 font-medium text-right">Posts</th>
                      <th className="pb-2 font-medium">Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_platform.map(p => (
                      <tr key={p.platform} className="border-t border-white/[0.06]">
                        <td className="py-2.5"><PlatformBadge platform={p.platform} /></td>
                        <td className="py-2.5 text-right text-slate-300">{fmt(p.posts)}</td>
                        <td className="py-2.5 pl-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden min-w-[80px]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(4, (p.engagement / maxPlatformEngagement) * 100)}%`,
                                  backgroundColor: platformColor(p.platform),
                                }}
                              />
                            </div>
                            <span className="text-slate-300 w-14 text-right">{fmt(p.engagement)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Engagement over time */}
            <div className="glass-card p-5">
              <h2 className="font-semibold text-white mb-4">Engagement Over Time</h2>
              {data.by_month.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">No dated posts in range</p>
              ) : (
                <div className="flex items-end gap-2 h-40 overflow-x-auto pb-1">
                  {data.by_month.map(m => (
                    <div key={m.month} className="flex-1 min-w-[36px] flex flex-col items-center justify-end h-full gap-1.5">
                      <span className="text-[10px] text-slate-400">{fmt(m.engagement)}</span>
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-sky-600 to-sky-400 transition-all"
                        style={{ height: `${Math.max(4, (m.engagement / maxMonthEngagement) * 100)}%` }}
                        title={`${monthLabel(m.month)}: ${fmt(m.engagement)} engagement, ${fmt(m.posts)} posts`}
                      />
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">{monthLabel(m.month)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top posts */}
          <div className="glass-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold text-white">Top Posts</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Filter by</label>
                <select value={sort} onChange={e => setSort(e.target.value as SortKey)} className={selectClass}>
                  {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            {sortedTop.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No posts to rank</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="text-left text-slate-500 text-xs uppercase tracking-wide">
                      <th className="pb-2 font-medium">Platform</th>
                      <th className="pb-2 font-medium">Client</th>
                      <th className="pb-2 font-medium">Post</th>
                      <th className="pb-2 font-medium text-right">Likes</th>
                      <th className="pb-2 font-medium text-right">Comments</th>
                      <th className="pb-2 font-medium text-right">Shares</th>
                      <th className="pb-2 font-medium text-right">Engagement</th>
                      <th className="pb-2 font-medium">Published</th>
                      <th className="pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTop.map(post => (
                      <tr key={post.id} className="border-t border-white/[0.06] align-top">
                        <td className="py-3 pr-3"><PlatformBadge platform={post.platform} /></td>
                        <td className="py-3 pr-3 text-slate-300 whitespace-nowrap">{post.client || '—'}</td>
                        <td className="py-3 pr-3 text-slate-400 max-w-[280px]">
                          <span className="line-clamp-2">{post.content_preview || '—'}</span>
                        </td>
                        <td className="py-3 text-right text-slate-300">{fmt(post.likes)}</td>
                        <td className="py-3 text-right text-slate-300">{fmt(post.comments)}</td>
                        <td className="py-3 text-right text-slate-300">{fmt(post.shares)}</td>
                        <td className="py-3 text-right font-semibold text-white">{fmt(post.engagement)}</td>
                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                          {post.scheduled_date ? new Date(post.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </td>
                        <td className="py-3">
                          {post.live_link && (
                            <a href={post.live_link} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 inline-flex">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
