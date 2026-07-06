'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bell, Check, Loader2, Send, ThumbsUp, BarChart3, Receipt, ShieldCheck,
  Mail, MonitorSmartphone, BellOff, MailX,
} from 'lucide-react'

type Channel = 'inapp' | 'email'
type Channels = { inapp: boolean; email: boolean }
type EventsMap = Record<string, Channels>
type Prefs = { muteAll: boolean; pauseEmail: boolean; events: EventsMap }

interface EventDef {
  key: string
  label: string
  description: string
  locked?: boolean // non-optional (always on), e.g. security
}
interface Group {
  key: string
  icon: any
  label: string
  helper: string
  events: EventDef[]
}

const GROUPS: Group[] = [
  {
    key: 'social', icon: Send, label: 'Social publishing',
    helper: 'Updates about scheduled and published posts across your connected social accounts, plus alerts when an account needs to be reconnected.',
    events: [
      { key: 'publish_success', label: 'Post published', description: 'When a scheduled post goes live successfully' },
      { key: 'publish_failed', label: 'Post failed to publish', description: 'When a post could not be published to a channel' },
      { key: 'reconnect', label: 'Reconnect needed', description: 'When a connected social account needs to be reconnected' },
      { key: 'token_expiry', label: 'Access expiring soon', description: 'When an account’s access token is about to expire' },
    ],
  },
  {
    key: 'approvals', icon: ThumbsUp, label: 'Approvals',
    helper: 'Notifications about content and proposals moving through your approval workflow.',
    events: [
      { key: 'approval_needed', label: 'Approval needed', description: 'When something is waiting on your review or sign-off' },
      { key: 'approval_approved', label: 'Approved', description: 'When an item you submitted is approved' },
      { key: 'approval_rejected', label: 'Rejected / changes requested', description: 'When an item is rejected or changes are requested' },
    ],
  },
  {
    key: 'reports', icon: BarChart3, label: 'Reports',
    helper: 'Keep track of automated reporting delivered to you and your clients.',
    events: [
      { key: 'report_scheduled', label: 'Scheduled report sent', description: 'When a scheduled report is generated and delivered' },
    ],
  },
  {
    key: 'billing', icon: Receipt, label: 'Billing & invoices',
    helper: 'Stay on top of invoice payments and overdue balances.',
    events: [
      { key: 'invoice_paid', label: 'Invoice paid', description: 'When an invoice is marked as paid' },
      { key: 'invoice_overdue', label: 'Invoice overdue', description: 'When an invoice passes its due date' },
    ],
  },
  {
    key: 'system', icon: ShieldCheck, label: 'System',
    helper: 'Account safety and product news. Security alerts can’t be turned off to keep your account protected.',
    events: [
      { key: 'security_alert', label: 'Security alerts', description: 'Unusual sign-in activity or account security events', locked: true },
      { key: 'product_updates', label: 'Product updates', description: 'Occasional news about new features and improvements' },
    ],
  },
]

const ALL_EVENTS = GROUPS.flatMap(g => g.events)
const LOCKED_KEYS = new Set(ALL_EVENTS.filter(e => e.locked).map(e => e.key))

function fallbackPrefs(): Prefs {
  return {
    muteAll: false,
    pauseEmail: false,
    events: Object.fromEntries(ALL_EVENTS.map(e => [e.key, { inapp: true, email: true }])),
  }
}

function Toggle({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${checked ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

const CHANNELS: { key: Channel; label: string; icon: any }[] = [
  { key: 'inapp', label: 'In-app', icon: MonitorSmartphone },
  { key: 'email', label: 'Email', icon: Mail },
]

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<Prefs>(fallbackPrefs())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/settings/notifications')
      .then(r => r.ok ? r.json() : {})
      .then((data: any) => {
        if (data?.prefs && typeof data.prefs === 'object') {
          const incoming = data.prefs as Partial<Prefs>
          setPrefs(prev => {
            const events = { ...prev.events }
            for (const e of ALL_EVENTS) {
              const row = incoming.events?.[e.key]
              if (row) events[e.key] = { ...events[e.key], ...row }
            }
            return {
              muteAll: typeof incoming.muteAll === 'boolean' ? incoming.muteAll : prev.muteAll,
              pauseEmail: typeof incoming.pauseEmail === 'boolean' ? incoming.pauseEmail : prev.pauseEmail,
              events,
            }
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const persist = useCallback((next: Prefs) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await fetch('/api/settings/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefs: next }),
        })
      } catch { /* graceful no-op */ }
      setSaving(false)
      setSaved(true)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaved(false), 2000)
    }, 600)
  }, [])

  const update = (mutate: (p: Prefs) => Prefs) => {
    setPrefs(p => {
      const next = mutate(p)
      persist(next)
      return next
    })
  }

  const setChannel = (eventKey: string, channel: Channel, val: boolean) => {
    if (LOCKED_KEYS.has(eventKey)) return
    update(p => ({
      ...p,
      events: { ...p.events, [eventKey]: { ...p.events[eventKey], [channel]: val } },
    }))
  }

  const setMuteAll = (val: boolean) => update(p => ({ ...p, muteAll: val }))
  const setPauseEmail = (val: boolean) => update(p => ({ ...p, pauseEmail: val }))

  // Effective channel state accounting for the master controls.
  const isOn = (eventKey: string, channel: Channel) => {
    if (LOCKED_KEYS.has(eventKey)) return true // locked always on
    const raw = prefs.events[eventKey]?.[channel] ?? false
    if (prefs.muteAll) return false
    if (channel === 'email' && prefs.pauseEmail) return false
    return raw
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        <div className="h-8 w-48 rounded-lg bg-slate-900/[0.04] dark:bg-white/[0.06] animate-pulse mb-6" />
        <div className="h-20 w-full rounded-2xl bg-slate-900/[0.04] dark:bg-white/[0.06] animate-pulse mb-4" />
        <div className="space-y-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="glass-card rounded-2xl p-5 space-y-3">
              <div className="h-4 w-32 rounded bg-slate-900/[0.06] dark:bg-white/[0.08] animate-pulse" />
              <div className="h-4 w-full rounded bg-slate-900/[0.04] dark:bg-white/[0.05] animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-slate-900/[0.04] dark:bg-white/[0.05] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-sky-400" /> Notifications
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Choose what you get notified about and how it reaches you.</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 shrink-0 h-8">
          {saving ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>)
            : saved ? (<><Check className="h-3.5 w-3.5 text-emerald-400" /> Saved</>)
              : null}
        </div>
      </div>

      {/* Master controls */}
      <div className="glass-card rounded-2xl p-5 mb-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              <BellOff className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Mute all notifications</p>
              <p className="text-xs text-slate-500 mt-0.5">Temporarily stop all in-app and email notifications. Security alerts still come through.</p>
            </div>
          </div>
          <Toggle checked={prefs.muteAll} onChange={setMuteAll} label="Mute all notifications" />
        </div>
        <div className="border-t border-slate-900/10 dark:border-white/[0.06]" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              <MailX className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pause all email</p>
              <p className="text-xs text-slate-500 mt-0.5">Keep in-app notifications but stop email delivery for everything below.</p>
            </div>
          </div>
          <Toggle checked={prefs.pauseEmail} disabled={prefs.muteAll} onChange={setPauseEmail} label="Pause all email" />
        </div>
      </div>

      <div className="space-y-4">
        {GROUPS.map(group => (
          <div key={group.key} className="glass-card rounded-2xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-slate-900/10 dark:border-white/[0.06] bg-slate-900/[0.03] dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <group.icon className="h-4 w-4 text-sky-400 shrink-0" />
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{group.label}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{group.helper}</p>
            </div>

            {/* Column headers */}
            <div className="hidden sm:flex items-center px-5 py-2 border-b border-slate-900/10 dark:border-white/[0.04]">
              <div className="flex-1" />
              <div className="flex items-center gap-6 shrink-0">
                {CHANNELS.map(c => (
                  <span key={c.key} className="w-14 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {c.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-900/10 dark:divide-white/[0.04]">
              {group.events.map(evt => {
                const locked = !!evt.locked
                return (
                  <div key={evt.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                        {evt.label}
                        {locked && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-900/[0.04] dark:bg-white/[0.06] rounded-full px-1.5 py-0.5 align-middle">
                            <ShieldCheck className="h-2.5 w-2.5" /> Always on
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{evt.description}</p>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      {CHANNELS.map(c => {
                        const globallyOff = !locked && (prefs.muteAll || (c.key === 'email' && prefs.pauseEmail))
                        return (
                          <div key={c.key} className="flex flex-col items-center gap-1 w-14">
                            <span className="sm:hidden text-[10px] font-medium text-slate-500 uppercase tracking-wider">{c.label}</span>
                            <Toggle
                              checked={isOn(evt.key, c.key)}
                              disabled={locked || globallyOff}
                              onChange={v => setChannel(evt.key, c.key, v)}
                              label={`${evt.label} — ${c.label}`}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-4">
        Security alerts can’t be turned off to keep your account safe. Changes save automatically.
      </p>
    </div>
  )
}
