'use client'
import { useState, useEffect } from 'react'
import { Shield, LogOut, Loader2 } from 'lucide-react'

const mockSessions = [
  { id: '1', device: 'Chrome on macOS', ip: '192.168.1.1', lastSeen: 'Just now', current: true },
  { id: '2', device: 'Mobile Safari on iPhone', ip: '10.0.0.5', lastSeen: '2 hours ago', current: false },
]

export default function SecuritySettingsPage() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [auditLog, setAuditLog] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(true)

  useEffect(() => {
    fetch('/api/audit-log')
      .then(res => res.json())
      .then(data => setAuditLog(Array.isArray(data) ? data : []))
      .catch(() => setAuditLog([]))
      .finally(() => setAuditLoading(false))
  }, [])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.new_password !== form.confirm_password) { setError('Passwords do not match'); return }
    if (form.new_password.length < 8) { setError('Password must be at least 8 characters'); return }
    setSaving(true)
    const res = await fetch('/api/settings/security', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: form.current_password, new_password: form.new_password }),
    })
    setSaving(false)
    if (res.ok) { setSuccess('Password updated successfully'); setForm({ current_password: '', new_password: '', confirm_password: '' }) }
    else { const d = await res.json(); setError(d.error || 'Failed to update password') }
  }

  return (
    <div className="p-4 lg:p-8 max-w-2xl space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-6 w-6 text-sky-400" />
        <h1 className="text-2xl font-bold text-white">Security & Sessions</h1>
      </div>

      {/* Active Sessions */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-white mb-4">Active Sessions</h2>
        <div className="divide-y divide-white/[0.06]">
          {mockSessions.map(session => (
            <div key={session.id} className="flex items-center justify-between py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{session.device}</p>
                  {session.current && <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">Current</span>}
                </div>
                <p className="text-xs text-slate-400">IP: {session.ip} · {session.lastSeen}</p>
              </div>
              {!session.current && (
                <button className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-medium">
                  <LogOut className="h-3.5 w-3.5" /> Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-white mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-1">Current Password</label><input className="input-glass" type="password" value={form.current_password} onChange={set('current_password')} required /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1">New Password</label><input className="input-glass" type="password" value={form.new_password} onChange={set('new_password')} required /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1">Confirm New Password</label><input className="input-glass" type="password" value={form.confirm_password} onChange={set('confirm_password')} required /></div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-400">{success}</p>}
          <button type="submit" disabled={saving} className="btn-brand flex items-center gap-2 disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
      {/* Audit Log */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-white mb-4">Audit Log</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Timestamp</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Action</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">User</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">IP Address</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {auditLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td className="py-2.5 px-3"><div className="h-3 skeleton rounded w-32" /></td>
                    <td className="py-2.5 px-3"><div className="h-3 skeleton rounded w-24" /></td>
                    <td className="py-2.5 px-3"><div className="h-3 skeleton rounded w-36" /></td>
                    <td className="py-2.5 px-3"><div className="h-3 skeleton rounded w-24" /></td>
                    <td className="py-2.5 px-3"><div className="h-3 skeleton rounded w-40" /></td>
                  </tr>
                ))
              ) : auditLog.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">No audit log entries</td>
                </tr>
              ) : (
                auditLog.map(entry => (
                  <tr key={entry.id} className="hover:bg-white/[0.03]">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-medium whitespace-nowrap">{entry.action}</td>
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {entry.users?.email || entry.user_id || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap font-mono text-xs">
                      {entry.ip_address || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                      {entry.details ? (typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details)) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
