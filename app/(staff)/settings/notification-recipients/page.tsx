'use client'
import { useState, useEffect } from 'react'
import { Mail, Plus, X, Loader2 } from 'lucide-react'

export default function NotificationRecipientsPage() {
  const [emails, setEmails] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    fetch('/api/settings/notification-recipients')
      .then(r => (r.ok ? r.json() : { emails: '' }))
      .then((d: { emails?: string }) => {
        const list = (d.emails || '').split(',').map((e: string) => e.trim()).filter(Boolean)
        setEmails(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const flash = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const addEmail = async () => {
    const trimmed = input.trim().toLowerCase()
    if (!trimmed || emails.includes(trimmed)) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address')
      return
    }
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/settings/notification-recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      if (res.ok) {
        setEmails(prev => [...prev, trimmed])
        setInput('')
        flash('Email added')
      } else {
        const d = await res.json()
        setError(d.error || 'Failed to add email')
      }
    } catch {
      setError('Network error — please try again')
    }
    setSaving(false)
  }

  const removeEmail = async (email: string) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings/notification-recipients', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setEmails(prev => prev.filter(e => e !== email))
        flash('Email removed')
      } else {
        const d = await res.json()
        setError(d.error || 'Failed to remove email')
      }
    } catch {
      setError('Network error — please try again')
    }
    setSaving(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addEmail()
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <Mail className="h-6 w-6 text-sky-400" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notification Recipients</h1>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        These email addresses receive notifications for new client &amp; proposal creation, invoice sends, and proposal approval/rejection events for your organization.
      </p>

      <div className="glass-card p-5 space-y-4">
        {/* Add email row */}
        <div className="flex gap-2">
          <input
            className="input-glass flex-1"
            type="email"
            placeholder="team@youragency.com"
            value={input}
            onChange={e => { setInput(e.target.value); setError('') }}
            onKeyDown={handleKeyDown}
            disabled={saving}
          />
          <button
            type="button"
            onClick={addEmail}
            disabled={saving || !input.trim()}
            className="btn-brand flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {successMsg && <p className="text-sm text-green-400 font-medium">✓ {successMsg}</p>}

        {/* Email list */}
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-600 dark:text-slate-400" />
          </div>
        ) : emails.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No recipients added yet. Add an email above.</p>
        ) : (
          <ul className="space-y-2">
            {emails.map(email => (
              <li key={email} className="flex items-center justify-between gap-2 bg-slate-900/[0.04] dark:bg-white/[0.04] rounded-xl px-4 py-2.5">
                <span className="text-sm text-slate-900 dark:text-slate-200 truncate">{email}</span>
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  disabled={saving}
                  className="shrink-0 p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
