'use client'
import { useState, useEffect } from 'react'
import { Bell, Check, Loader2, Users, FolderKanban, BarChart3, Settings2, Mail, X, Plus } from 'lucide-react'

interface NotifItem {
  key: string
  label: string
  description: string
}

const CATEGORIES: { icon: any; label: string; items: NotifItem[] }[] = [
  {
    icon: Users,
    label: 'Client',
    items: [
      { key: 'notif_client_added', label: 'New client added', description: 'When a new client is onboarded' },
      { key: 'notif_client_message', label: 'Client message received', description: 'When a client sends a message via the portal' },
      { key: 'notif_proposal_approved', label: 'Proposal approved', description: 'When a client approves a proposal' },
      { key: 'notif_proposal_rejected', label: 'Proposal rejected', description: 'When a client rejects a proposal' },
    ],
  },
  {
    icon: FolderKanban,
    label: 'Project',
    items: [
      { key: 'notif_project_created', label: 'New project created', description: 'When a new project is added' },
      { key: 'notif_project_status_change', label: 'Project status changed', description: 'When a project changes status' },
      { key: 'notif_deadline_approaching', label: 'Deadline approaching', description: '3 days before a project deadline' },
      { key: 'notif_task_completed', label: 'Task completed', description: 'When a deliverable task is marked complete' },
    ],
  },
  {
    icon: BarChart3,
    label: 'Team & Reports',
    items: [
      { key: 'notif_weekly_targets', label: 'Weekly targets report', description: 'Sent every Monday with last week\'s performance' },
      { key: 'notif_friday_reminder', label: 'Friday submission reminder', description: 'Sent every Friday for pending submissions' },
      { key: 'notif_missed_target', label: 'Missed target alert', description: 'When a team member misses a weekly target' },
      { key: 'notif_monthly_report', label: 'Monthly report ready', description: 'When the monthly report is generated' },
    ],
  },
  {
    icon: Settings2,
    label: 'System',
    items: [
      { key: 'notif_integration_error', label: 'Integration error', description: 'When a connected integration (QB, Google) fails' },
      { key: 'notif_new_team_member', label: 'New team member', description: 'When someone joins your organization' },
      { key: 'notif_billing_reminder', label: 'Billing reminder', description: 'Upcoming subscription renewal reminders' },
    ],
  },
]

const ALL_KEYS = CATEGORIES.flatMap(c => c.items.flatMap(i => [`${i.key}_email`, `${i.key}_inapp`]))
const defaultPrefs = () => Object.fromEntries(ALL_KEYS.map(k => [k, true]))

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${checked ? 'bg-sky-500' : 'bg-slate-700'}`}>
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(defaultPrefs())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Notification recipients (org-level)
  const [recipientEmails, setRecipientEmails] = useState<string[]>([])
  const [recipientInput, setRecipientInput] = useState('')
  const [savingRecipients, setSavingRecipients] = useState(false)
  const [recipientsSaved, setRecipientsSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings/notifications')
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        setPrefs(p => ({ ...p, ...data }))
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

  const set = (key: string, val: boolean) => setPrefs(p => ({ ...p, [key]: val }))

  const save = async () => {
    setSaving(true)
    await fetch('/api/settings/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <div className="p-8 flex items-center gap-2 text-slate-400 text-sm">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading preferences…
    </div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-sky-400" /> Notifications
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Choose how and when you want to be notified</p>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 btn-brand px-4 py-2 rounded-xl text-sm font-medium shrink-0 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Preferences'}
        </button>
      </div>

      {/* Channel header */}
      <div className="flex justify-end gap-6 pr-4 mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-12 text-center">Email</span>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-12 text-center">In-App</span>
      </div>

      {/* Notification Recipients */}
      <div className="glass-card rounded-2xl overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-sky-400" />
            <span className="text-sm font-semibold text-slate-200">Client Notification Recipients</span>
          </div>
          <button onClick={saveRecipients} disabled={savingRecipients}
            className="flex items-center gap-1.5 text-xs btn-brand px-3 py-1.5 rounded-lg font-medium disabled:opacity-60">
            {savingRecipients ? <Loader2 className="h-3 w-3 animate-spin" /> : recipientsSaved ? <Check className="h-3 w-3" /> : null}
            {savingRecipients ? 'Saving…' : recipientsSaved ? 'Saved!' : 'Save'}
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-400">These email addresses receive a notification whenever a new client is added. Typically your accountant, sales agent, marketing manager, etc.</p>
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
              className="flex-1 bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 placeholder:text-slate-500"
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

      <div className="space-y-4">
        {CATEGORIES.map(cat => (
          <div key={cat.label} className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <cat.icon className="h-4 w-4 text-sky-400" />
              <span className="text-sm font-semibold text-slate-200">{cat.label}</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {cat.items.map(item => (
                <div key={item.key} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="w-12 flex justify-center">
                      <Toggle checked={!!prefs[`${item.key}_email`]} onChange={v => set(`${item.key}_email`, v)} />
                    </div>
                    <div className="w-12 flex justify-center">
                      <Toggle checked={!!prefs[`${item.key}_inapp`]} onChange={v => set(`${item.key}_inapp`, v)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky save on mobile */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden p-4 bg-[#0a1628]/90 backdrop-blur-sm border-t border-white/[0.08]">
        <button onClick={save} disabled={saving}
          className="w-full flex items-center justify-center gap-2 btn-brand py-3 rounded-xl text-sm font-semibold disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Preferences'}
        </button>
      </div>
      <div className="h-20 lg:hidden" />
    </div>
  )
}
