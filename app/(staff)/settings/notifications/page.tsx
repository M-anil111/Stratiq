'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bell, Check, Loader2, Users, FolderKanban, Target, Receipt, MessageSquare,
  BarChart3, UserCog, ThumbsUp, ShieldCheck, Settings2, Mail, X, Plus,
  Search, ChevronDown, Smartphone, Monitor,
} from 'lucide-react'

type Channel = 'email' | 'bell' | 'popup'
type Channels = { email: boolean; bell: boolean; popup: boolean }
type PrefsMap = Record<string, Channels>

interface Topic {
  key: string
  label: string
  description: string
  locked?: boolean // non-optional (always on), e.g. security
}
interface Group {
  key: string
  icon: any
  label: string
  topics: Topic[]
}

const GROUPS: Group[] = [
  {
    key: 'clients', icon: Users, label: 'Clients & Contacts', topics: [
      { key: 'client_assigned', label: 'Client assigned to you', description: 'When a client is assigned to you as owner' },
      { key: 'client_added', label: 'New client added', description: 'When a new client is added to your organization' },
      { key: 'mention', label: '@-mention', description: 'When someone @-mentions you in a note or comment' },
    ],
  },
  {
    key: 'projects', icon: FolderKanban, label: 'Projects', topics: [
      { key: 'project_assigned', label: 'Project assigned', description: 'When a project is assigned to you' },
      { key: 'project_status', label: 'Project status changed', description: 'When a project you follow changes status' },
    ],
  },
  {
    key: 'leads', icon: Target, label: 'Leads', topics: [
      { key: 'lead_assigned', label: 'Lead assigned', description: 'When a lead is assigned to you' },
      { key: 'lead_stage', label: 'Lead stage changed', description: 'When a lead moves to a new pipeline stage' },
    ],
  },
  {
    key: 'invoices', icon: Receipt, label: 'Invoices & Payments', topics: [
      { key: 'invoice_paid', label: 'Invoice paid', description: 'When an invoice is marked as paid' },
      { key: 'invoice_overdue', label: 'Invoice overdue', description: 'When an invoice passes its due date' },
      { key: 'payment_received', label: 'Payment received', description: 'When a Helcim payment is received' },
    ],
  },
  {
    key: 'messages', icon: MessageSquare, label: 'Messages', topics: [
      { key: 'client_message', label: 'New message from a client', description: 'When a client sends a message via the portal' },
    ],
  },
  {
    key: 'reports', icon: BarChart3, label: 'Reports', topics: [
      { key: 'report_sent', label: 'Report sent', description: 'When a report is sent to a client' },
      { key: 'report_scheduled', label: 'Scheduled report generated', description: 'When a scheduled report is generated' },
    ],
  },
  {
    key: 'team', icon: UserCog, label: 'Team', topics: [
      { key: 'invite_accepted', label: 'Invite accepted', description: 'When a team invite is accepted' },
      { key: 'role_changed', label: 'Role changed', description: 'When your role or permissions change' },
    ],
  },
  {
    key: 'approvals', icon: ThumbsUp, label: 'Approvals', topics: [
      { key: 'proposal_decision', label: 'Proposal approved / rejected', description: 'When a client approves or rejects a proposal' },
    ],
  },
  {
    key: 'security', icon: ShieldCheck, label: 'Security', topics: [
      { key: 'suspicious_login', label: 'Suspicious login', description: 'Unusual sign-in activity on your account', locked: true },
      { key: 'new_signin', label: 'New sign-in verification', description: 'Verification for sign-ins from a new device', locked: true },
    ],
  },
  {
    key: 'system', icon: Settings2, label: 'System', topics: [
      { key: 'import_complete', label: 'Import complete', description: 'When a data import finishes' },
      { key: 'export_ready', label: 'Export ready', description: 'When an export is ready to download' },
      { key: 'integration_disconnected', label: 'Integration disconnected', description: 'When a connected integration disconnects' },
      { key: 'sync_error', label: 'Sync error', description: 'When a background sync fails' },
    ],
  },
]

const ALL_TOPICS = GROUPS.flatMap(g => g.topics)
const LOCKED_KEYS = new Set(ALL_TOPICS.filter(t => t.locked).map(t => t.key))

function fallbackDefaults(): PrefsMap {
  return Object.fromEntries(ALL_TOPICS.map(t => [t.key, { email: true, bell: true, popup: false }]))
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${checked ? 'bg-sky-500' : 'bg-slate-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'bell', label: 'Bell' },
  { key: 'popup', label: 'Pop-up' },
]

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<PrefsMap>(fallbackDefaults())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'desktop' | 'mobile'>('desktop')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Notification recipients (org-level) — preserved existing feature.
  const [recipientEmails, setRecipientEmails] = useState<string[]>([])
  const [recipientInput, setRecipientInput] = useState('')
  const [savingRecipients, setSavingRecipients] = useState(false)
  const [recipientsSaved, setRecipientsSaved] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/settings/notifications')
      .then(r => r.ok ? r.json() : {})
      .then((data: any) => {
        if (data && data.prefs && typeof data.prefs === 'object') {
          setPrefs(p => {
            const next = { ...p }
            for (const t of ALL_TOPICS) {
              if (data.prefs[t.key]) next[t.key] = { ...next[t.key], ...data.prefs[t.key] }
            }
            return next
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
    fetch('/api/settings/notification-recipients')
      .then(r => r.ok ? r.json() : { emails: '' })
      .then(d => {
        const list = (d.emails || '').split(',').map((e: string) => e.trim()).filter(Boolean)
        setRecipientEmails(list)
      })
      .catch(() => {})
  }, [])

  const persist = useCallback((next: PrefsMap) => {
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

  const setChannel = (topicKey: string, channel: Channel, val: boolean) => {
    if (LOCKED_KEYS.has(topicKey)) return
    setPrefs(p => {
      const next = { ...p, [topicKey]: { ...p[topicKey], [channel]: val } }
      persist(next)
      return next
    })
  }

  const turnOffAll = () => {
    setPrefs(p => {
      const next: PrefsMap = { ...p }
      for (const t of ALL_TOPICS) {
        if (LOCKED_KEYS.has(t.key)) continue
        next[t.key] = { email: false, bell: false, popup: false }
      }
      persist(next)
      return next
    })
  }

  const addRecipient = () => {
    const email = recipientInput.trim().toLowerCase()
    if (!email || recipientEmails.includes(email)) { setRecipientInput(''); return }
    setRecipientEmails(v => [...v, email])
    setRecipientInput('')
  }

  const saveRecipients = async () => {
    setSavingRecipients(true)
    await fetch('/api/settings/notification-recipients', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: recipientEmails.join(',') }),
    })
    setSavingRecipients(false)
    setRecipientsSaved(true)
    setTimeout(() => setRecipientsSaved(false), 2500)
  }

  const q = query.trim().toLowerCase()
  const filteredGroups = GROUPS
    .map(g => ({
      ...g,
      topics: q
        ? g.topics.filter(t => t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
        : g.topics,
    }))
    .filter(g => g.topics.length > 0)

  const bellColLabel = tab === 'mobile' ? 'Push' : 'Bell'

  if (loading) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        <div className="h-8 w-48 rounded-lg bg-slate-900/[0.04] dark:bg-white/[0.06] animate-pulse mb-6" />
        <div className="h-10 w-full rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.06] animate-pulse mb-4" />
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
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Choose what you get notified about and where</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 shrink-0 h-8">
          {saving ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>)
            : saved ? (<><Check className="h-3.5 w-3.5 text-emerald-400" /> Saved</>)
              : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-900/10 dark:border-white/[0.06] mb-4 w-full sm:w-auto sm:inline-flex">
        <button onClick={() => setTab('desktop')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'desktop' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}>
          <Monitor className="h-4 w-4" /> Email & Bell
        </button>
        <button onClick={() => setTab('mobile')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'mobile' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}>
          <Smartphone className="h-4 w-4" /> Mobile
        </button>
      </div>

      {tab === 'mobile' && (
        <div className="glass-card rounded-xl px-4 py-3 mb-4 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
          <Smartphone className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <span>There isn&apos;t a separate mobile app yet — mobile push mirrors your Bell settings below. The &ldquo;Push&rdquo; column controls what would be pushed to your phone once the app ships.</span>
        </div>
      )}

      {/* Search + turn off all */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search notifications…"
            className="w-full bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 placeholder:text-slate-500"
          />
        </div>
        <button onClick={turnOffAll}
          className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-900/[0.04] dark:bg-white/[0.05] border border-slate-900/10 dark:border-white/[0.1] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] transition-colors">
          Turn off all
        </button>
      </div>

      <div className="space-y-4">
        {filteredGroups.length === 0 && (
          <div className="glass-card rounded-2xl px-5 py-8 text-center text-sm text-slate-500">
            No notifications match &ldquo;{query}&rdquo;.
          </div>
        )}
        {filteredGroups.map(group => {
          const isCollapsed = !!collapsed[group.key] && !q
          return (
            <div key={group.key} className="glass-card rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setCollapsed(c => ({ ...c, [group.key]: !c[group.key] }))}
                className="w-full flex items-center gap-2 px-5 py-3 border-b border-slate-900/10 dark:border-white/[0.06] bg-slate-900/[0.03] dark:bg-white/[0.02] text-left"
              >
                <group.icon className="h-4 w-4 text-sky-400 shrink-0" />
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex-1">{group.label}</span>
                <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
              </button>

              {!isCollapsed && (
                <div>
                  {/* Column headers (once per section) — hidden on narrow screens where rows stack */}
                  <div className="hidden sm:flex items-center px-5 py-2 border-b border-slate-900/10 dark:border-white/[0.04]">
                    <div className="flex-1" />
                    <div className="flex items-center gap-6 shrink-0">
                      {CHANNELS.map(c => (
                        <span key={c.key} className="w-12 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          {c.key === 'bell' ? bellColLabel : c.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-900/10 dark:divide-white/[0.04]">
                    {group.topics.map(topic => {
                      const ch = prefs[topic.key] || { email: false, bell: false, popup: false }
                      const locked = !!topic.locked
                      return (
                        <div key={topic.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-3.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                              {topic.label}
                              {locked && (
                                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-900/[0.04] dark:bg-white/[0.06] rounded-full px-1.5 py-0.5 align-middle">
                                  <ShieldCheck className="h-2.5 w-2.5" /> Always on
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">{topic.description}</p>
                          </div>
                          <div className="flex items-center gap-6 shrink-0">
                            {CHANNELS.map(c => (
                              <div key={c.key} className="flex flex-col items-center gap-1 w-12">
                                {/* per-row inline label on mobile only */}
                                <span className="sm:hidden text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                                  {c.key === 'bell' ? bellColLabel : c.label}
                                </span>
                                <Toggle
                                  checked={locked ? true : !!ch[c.key]}
                                  disabled={locked}
                                  onChange={v => setChannel(topic.key, c.key, v)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-500 mt-4">
        Some security notifications can&apos;t be turned off to keep your account safe.
      </p>

      {/* Notification Recipients (org-level) */}
      <div className="glass-card rounded-2xl overflow-hidden my-6">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-900/10 dark:border-white/[0.06] bg-slate-900/[0.03] dark:bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-sky-400" />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">Client Notification Recipients</span>
          </div>
          <button onClick={saveRecipients} disabled={savingRecipients}
            className="flex items-center gap-1.5 text-xs btn-brand px-3 py-1.5 rounded-lg font-medium disabled:opacity-60">
            {savingRecipients ? <Loader2 className="h-3 w-3 animate-spin" /> : recipientsSaved ? <Check className="h-3 w-3" /> : null}
            {savingRecipients ? 'Saving…' : recipientsSaved ? 'Saved!' : 'Save'}
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">These email addresses receive a notification whenever a new client is added. Typically your accountant, sales agent, marketing manager, etc.</p>
          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {recipientEmails.map(email => (
              <span key={email} className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/20 px-3 py-1 text-sm">
                {email}
                <button type="button" onClick={() => setRecipientEmails(v => v.filter(e => e !== email))}>
                  <X className="h-3 w-3 text-sky-400 hover:text-red-400" />
                </button>
              </span>
            ))}
            {recipientEmails.length === 0 && <p className="text-sm text-slate-600">No recipients added yet</p>}
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              className="flex-1 bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 placeholder:text-slate-500"
              placeholder="accountant@example.com"
              value={recipientInput}
              onChange={e => setRecipientInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRecipient() } }}
            />
            <button type="button" onClick={addRecipient}
              className="flex items-center gap-1 px-3 py-2 bg-sky-500/20 border border-sky-500/30 text-sky-400 rounded-lg text-sm hover:bg-sky-500/30 transition-colors">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
