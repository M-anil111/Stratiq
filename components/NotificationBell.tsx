'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X, CheckCheck, Info, AlertTriangle, CheckCircle, MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  title: string
  body?: string
  type: string
  severity?: string
  url?: string
  link?: string
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

function NotificationIcon({ type }: { type: string }) {
  const cls = 'w-4 h-4 shrink-0 mt-0.5'
  switch (type) {
    case 'success': return <CheckCircle className={`${cls} text-green-400`} />
    case 'warning': return <AlertTriangle className={`${cls} text-yellow-400`} />
    case 'error': return <AlertTriangle className={`${cls} text-red-400`} />
    case 'message': return <MessageSquare className={`${cls} text-blue-400`} />
    default: return <Info className={`${cls} text-indigo-400`} />
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unread_count ?? 0)
    } catch {
      // silently fail — bell shows 0
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markRead(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id))
    setUnreadCount(prev => Math.max(0, prev - 1))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  async function markAllRead() {
    setNotifications([])
    setUnreadCount(0)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all_read: true }),
    })
  }

  async function handleNotificationClick(n: Notification) {
    await markRead(n.id)
    setOpen(false)
    const dest = n.link || n.url
    if (dest) router.push(dest)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(prev => !prev)}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-xl text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl border border-white/[0.08] bg-[#0f1117] z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-semibold text-white">Notifications</span>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/30">
                <Bell className="w-8 h-8 mb-2" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <ul>
                {notifications.map(n => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleNotificationClick(n)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0"
                    >
                      <span className={`w-2 h-2 shrink-0 mt-1.5 rounded-full ${SEVERITY_DOT[n.severity || ''] || 'bg-indigo-400'}`} />
                      <NotificationIcon type={n.severity || n.type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{n.title}</p>
                        {n.body && (
                          <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{n.body}</p>
                        )}
                        <p className="text-[11px] text-white/30 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.06]">
            <button
              onClick={() => { setOpen(false); router.push('/notifications') }}
              className="w-full px-4 py-3 text-center text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-white/[0.04] transition-colors"
            >
              View all
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
