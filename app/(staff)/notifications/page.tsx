'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, CheckCheck, Info, AlertTriangle, CheckCircle, Loader2,
} from 'lucide-react'

interface Notification {
  id: string
  title: string
  body?: string
  type: string
  severity?: string
  link?: string
  url?: string
  created_at: string
  is_read: boolean
}

const SEVERITY_DOT: Record<string, string> = {
  success: 'bg-green-400',
  warning: 'bg-yellow-400',
  error: 'bg-red-400',
  info: 'bg-indigo-400',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function SeverityIcon({ severity }: { severity: string }) {
  const cls = 'w-4 h-4 shrink-0'
  switch (severity) {
    case 'success': return <CheckCircle className={`${cls} text-green-400`} />
    case 'warning': return <AlertTriangle className={`${cls} text-yellow-400`} />
    case 'error': return <AlertTriangle className={`${cls} text-red-400`} />
    default: return <Info className={`${cls} text-indigo-400`} />
  }
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications?all=1')
      const data = await res.json()
      setNotifications(data.notifications ?? [])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const types = useMemo(() => {
    const set = new Set<string>()
    notifications.forEach(n => n.type && set.add(n.type))
    return Array.from(set)
  }, [notifications])

  const filtered = useMemo(
    () => typeFilter === 'all' ? notifications : notifications.filter(n => n.type === typeFilter),
    [notifications, typeFilter],
  )

  async function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  async function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all_read: true }),
    })
  }

  async function handleClick(n: Notification) {
    if (!n.is_read) await markRead(n.id)
    const dest = n.link || n.url
    if (dest) router.push(dest)
  }

  const hasUnread = notifications.some(n => !n.is_read)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-indigo-400 shrink-0" />
          <h1 className="text-xl sm:text-2xl font-semibold text-white">Notifications</h1>
        </div>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {/* Type filter */}
      {types.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-5 bg-white/[0.04] p-1 rounded-xl w-fit">
          {['all', ...types].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${typeFilter === t ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {t === 'all' ? 'All' : t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map(i => <div key={i} className="glass-card rounded-2xl p-4 animate-pulse h-16" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Bell className="h-8 w-8 text-slate-500 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No notifications.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map(n => (
            <li key={n.id}>
              <button
                onClick={() => handleClick(n)}
                className={`w-full flex items-start gap-3 px-4 py-3.5 text-left rounded-2xl border transition-colors ${n.is_read ? 'glass-card border-white/[0.06] opacity-70 hover:opacity-100' : 'bg-white/[0.06] border-white/[0.12] hover:bg-white/[0.09]'}`}
              >
                <span className={`w-2 h-2 shrink-0 mt-2 rounded-full ${SEVERITY_DOT[n.severity || ''] || 'bg-indigo-400'}`} />
                <SeverityIcon severity={n.severity || n.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{n.title}</p>
                    {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
                  </div>
                  {n.body && <p className="text-xs text-white/50 mt-0.5">{n.body}</p>}
                  <p className="text-[11px] text-white/30 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
