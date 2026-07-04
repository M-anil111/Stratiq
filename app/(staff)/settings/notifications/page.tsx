'use client'
import { useState } from 'react'
import { Bell } from 'lucide-react'

interface Prefs {
  weekly_target_email: boolean
  friday_reminder_email: boolean
  missed_target_email: boolean
  monthly_report_email: boolean
  new_message_email: boolean
  new_client_email: boolean
}

const defaultPrefs: Prefs = {
  weekly_target_email: true,
  friday_reminder_email: true,
  missed_target_email: true,
  monthly_report_email: true,
  new_message_email: true,
  new_client_email: false,
}

const prefLabels: { key: keyof Prefs; label: string; description: string }[] = [
  { key: 'weekly_target_email', label: 'Weekly Target Summary', description: 'Every Monday morning with your activity targets for the week' },
  { key: 'friday_reminder_email', label: 'Friday Deadline Reminder', description: 'Friday afternoon if you have incomplete activities' },
  { key: 'missed_target_email', label: 'Missed Target Alert', description: 'When a team member misses their weekly target' },
  { key: 'monthly_report_email', label: 'Monthly Report Summary', description: '1st of each month with previous month\'s performance' },
  { key: 'new_message_email', label: 'New Client Message', description: 'When a client sends a message through the portal' },
  { key: 'new_client_email', label: 'New Client Added', description: 'When a new client is added to the system' },
]

export default function NotificationsSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs)
  const [saved, setSaved] = useState(false)

  const toggle = (key: keyof Prefs) => setPrefs(p => ({ ...p, [key]: !p[key] }))

  const save = async () => {
    await fetch('/api/settings/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="p-4 lg:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-6 w-6 text-sky-400" />
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
      </div>

      <div className="glass-card divide-y divide-white/[0.06]">
        {prefLabels.map(({ key, label, description }) => (
          <div key={key} className="flex items-start justify-between p-4 gap-4">
            <div>
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
            <button
              onClick={() => toggle(key)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${prefs[key] ? 'bg-sky-500' : 'bg-white/[0.12]'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${prefs[key] ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button onClick={save} className="btn-brand">Save Preferences</button>
        {saved && <span className="text-sm text-green-400 font-medium">✓ Saved</span>}
      </div>
    </div>
  )
}
