'use client'

import { useEffect, useState } from 'react'
import { User, Lock, Save, KeyRound } from 'lucide-react'

interface UserProfile {
  full_name: string
  email: string
  phone: string
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      {children}
    </div>
  )
}

export default function AccountPage() {
  const [profile, setProfile] = useState<UserProfile>({ full_name: '', email: '', phone: '' })
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/portal/account')
      .then(r => r.json())
      .then(data => setProfile(data))
      .catch(() => {})
      .finally(() => setLoadingProfile(false))
  }, [])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMsg(null)
    try {
      const res = await fetch('/api/portal/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: profile.full_name, phone: profile.phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setProfileMsg({ ok: true, text: 'Profile updated successfully.' })
    } catch (err: any) {
      setProfileMsg({ ok: false, text: err.message })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setSavingPwd(true)
    setPwdMsg(null)
    try {
      const res = await fetch('/api/portal/account/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwords),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to change password')
      setPwdMsg({ ok: true, text: 'Password changed successfully.' })
      setPasswords({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err: any) {
      setPwdMsg({ ok: false, text: err.message })
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">My Account</h1>
        <p className="text-slate-400 mt-1">Manage your profile and security settings</p>
      </div>

      {/* Profile section */}
      <div className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <User className="h-5 w-5 text-sky-400" />
          <h2 className="font-semibold text-white">Profile Information</h2>
        </div>

        {loadingProfile ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-20 bg-white/10 rounded" />
                <div className="h-10 bg-white/10 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Field label="Full Name">
              <input
                className="input-glass w-full"
                value={profile.full_name}
                onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Your name"
              />
            </Field>
            <Field label="Email">
              <input
                className="input-glass w-full opacity-60 cursor-not-allowed"
                value={profile.email}
                readOnly
                disabled
              />
            </Field>
            <Field label="Phone">
              <input
                className="input-glass w-full"
                value={profile.phone}
                onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                placeholder="+1 (555) 000-0000"
                type="tel"
              />
            </Field>

            {profileMsg && (
              <p className={`text-sm ${profileMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
                {profileMsg.text}
              </p>
            )}

            <button type="submit" disabled={savingProfile} className="btn-brand flex items-center gap-2 disabled:opacity-60">
              <Save className="h-4 w-4" />
              {savingProfile ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        )}
      </div>

      {/* Change password section */}
      <div className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-5 w-5 text-sky-400" />
          <h2 className="font-semibold text-white">Change Password</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <Field label="Current Password">
            <input
              className="input-glass w-full"
              type="password"
              value={passwords.current_password}
              onChange={e => setPasswords(p => ({ ...p, current_password: e.target.value }))}
              placeholder="••••••••"
            />
          </Field>
          <Field label="New Password">
            <input
              className="input-glass w-full"
              type="password"
              value={passwords.new_password}
              onChange={e => setPasswords(p => ({ ...p, new_password: e.target.value }))}
              placeholder="••••••••"
            />
          </Field>
          <Field label="Confirm New Password">
            <input
              className="input-glass w-full"
              type="password"
              value={passwords.confirm_password}
              onChange={e => setPasswords(p => ({ ...p, confirm_password: e.target.value }))}
              placeholder="••••••••"
            />
          </Field>

          {pwdMsg && (
            <p className={`text-sm ${pwdMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
              {pwdMsg.text}
            </p>
          )}

          <button type="submit" disabled={savingPwd} className="btn-brand flex items-center gap-2 disabled:opacity-60">
            <KeyRound className="h-4 w-4" />
            {savingPwd ? 'Changing…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
