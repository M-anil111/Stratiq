'use client'
import { useState } from 'react'
import { Shield, LogOut, Loader2 } from 'lucide-react'

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"

const mockSessions = [
  { id: '1', device: 'Chrome on macOS', ip: '192.168.1.1', lastSeen: 'Just now', current: true },
  { id: '2', device: 'Mobile Safari on iPhone', ip: '10.0.0.5', lastSeen: '2 hours ago', current: false },
]

export default function SecuritySettingsPage() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
        <Shield className="h-6 w-6 text-sky-600" />
        <h1 className="text-2xl font-bold text-gray-900">Security & Sessions</h1>
      </div>

      {/* Active Sessions */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Active Sessions</h2>
        <div className="divide-y divide-gray-50">
          {mockSessions.map(session => (
            <div key={session.id} className="flex items-center justify-between py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{session.device}</p>
                  {session.current && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">Current</span>}
                </div>
                <p className="text-xs text-gray-500">IP: {session.ip} · {session.lastSeen}</p>
              </div>
              {!session.current && (
                <button className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium">
                  <LogOut className="h-3.5 w-3.5" /> Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label><input className={inputClass} type="password" value={form.current_password} onChange={set('current_password')} required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">New Password</label><input className={inputClass} type="password" value={form.new_password} onChange={set('new_password')} required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label><input className={inputClass} type="password" value={form.confirm_password} onChange={set('confirm_password')} required /></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
