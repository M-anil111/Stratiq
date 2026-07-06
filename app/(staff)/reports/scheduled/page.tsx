'use client'
import { useState, useEffect } from 'react'
import { Plus, X, Calendar, Clock, Mail, Trash2 } from 'lucide-react'

interface Client { id: string; company_name: string }

const selectClass = "w-full bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

const REPORT_TYPES = ['Google Ads', 'Meta Ads', 'Marketing Summary']
const FREQUENCIES = ['Weekly', 'Monthly']
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => String(i + 1))

interface ScheduledReport {
  id: string
  client: string
  type: string
  frequency: string
  recipients: string[]
  day: string
  nextRun: string
  status: 'active' | 'paused'
}

export default function ScheduledReportsPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [saving, setSaving] = useState(false)

  // Modal form state
  const [fClientId, setFClientId] = useState('')
  const [fType, setFType] = useState(REPORT_TYPES[0])
  const [fFrequency, setFFrequency] = useState(FREQUENCIES[0])
  const [fDay, setFDay] = useState(DAYS_OF_WEEK[0])
  const [fEmailInput, setFEmailInput] = useState('')
  const [fRecipients, setFRecipients] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => {
      const list = data?.clients || (Array.isArray(data) ? data : [])
      setClients(list)
    }).catch(() => {})
    fetch('/api/reports/scheduled').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setReports(data)
    }).catch(() => {})
  }, [])

  function openModal() {
    setFClientId('')
    setFType(REPORT_TYPES[0])
    setFFrequency(FREQUENCIES[0])
    setFDay(DAYS_OF_WEEK[0])
    setFEmailInput('')
    setFRecipients([])
    setModalOpen(true)
  }

  function addEmail() {
    const email = fEmailInput.trim()
    if (!email || fRecipients.includes(email)) { setFEmailInput(''); return }
    setFRecipients(r => [...r, email])
    setFEmailInput('')
  }

  function removeEmail(email: string) {
    setFRecipients(r => r.filter(e => e !== email))
  }

  function handleEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail() }
  }

  async function handleSchedule() {
    const clientName = clients.find(c => c.id === fClientId)?.company_name ?? fClientId
    setSaving(true)
    const res = await fetch('/api/reports/scheduled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: fClientId,
        client: clientName || 'Unknown Client',
        type: fType,
        frequency: fFrequency,
        recipients: fRecipients,
        day: fDay,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const newReport = await res.json()
      setReports(r => [{ ...newReport, nextRun: 'Scheduled', status: 'active' }, ...r])
    }
    setModalOpen(false)
  }

  async function deleteReport(id: string) {
    setReports(r => r.filter(rep => rep.id !== id))
    await fetch('/api/reports/scheduled', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  async function toggleStatus(id: string, current: 'active' | 'paused') {
    const next = current === 'active' ? 'paused' : 'active'
    setReports(r => r.map(rep => rep.id === id ? { ...rep, status: next } : rep))
    await fetch('/api/reports/scheduled', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: next }),
    })
  }

  const dayOptions = fFrequency === 'Weekly' ? DAYS_OF_WEEK : DAYS_OF_MONTH

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Scheduled Reports</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Automate report delivery to clients and stakeholders</p>
        </div>
        <button onClick={openModal} className="btn-brand flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
          <Plus className="h-4 w-4" /> Schedule New Report
        </button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-900/10 dark:border-white/[0.08]">
                {['Client', 'Report Type', 'Frequency', 'Day', 'Recipients', 'Next Run', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-600 dark:text-slate-400 px-5 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Calendar className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-600 dark:text-slate-400 font-medium">No scheduled reports yet</p>
                    <p className="text-slate-500 text-xs mt-1">Click "Schedule New Report" to set up automated delivery.</p>
                  </td>
                </tr>
              ) : reports.map(rep => (
                <tr key={rep.id} className="border-b border-slate-900/10 dark:border-white/[0.04] hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.03] transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">{rep.client}</td>
                  <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">{rep.type}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                      <Clock className="h-3.5 w-3.5 text-slate-500" /> {rep.frequency}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">{rep.frequency === 'Monthly' ? `Day ${rep.day}` : rep.day}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {rep.recipients.map(email => (
                        <span key={email} className="inline-flex items-center gap-1 bg-slate-900/[0.04] dark:bg-white/[0.07] text-slate-700 dark:text-slate-300 text-xs px-2 py-0.5 rounded-full">
                          <Mail className="h-2.5 w-2.5" /> {email}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{rep.nextRun}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${rep.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-600 dark:text-slate-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${rep.status === 'active' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      {rep.status === 'active' ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleStatus(rep.id, rep.status)}
                        title={rep.status === 'active' ? 'Pause' : 'Resume'}
                        className={`p-1 rounded transition-colors text-xs font-medium px-2 py-1 border ${rep.status === 'active' ? 'border-slate-600 text-slate-600 dark:text-slate-400 hover:text-amber-400 hover:border-amber-400' : 'border-slate-600 text-slate-600 dark:text-slate-400 hover:text-emerald-400 hover:border-emerald-400'}`}>
                        {rep.status === 'active' ? 'Pause' : 'Resume'}
                      </button>
                      <button onClick={() => deleteReport(rep.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative glass-card w-full max-w-lg p-6 z-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Schedule New Report</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Client */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Client</label>
                <select value={fClientId} onChange={e => setFClientId(e.target.value)} className={selectClass}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>

              {/* Report Type */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Report Type</label>
                <select value={fType} onChange={e => setFType(e.target.value)} className={selectClass}>
                  {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Frequency</label>
                <div className="flex gap-2">
                  {FREQUENCIES.map(f => (
                    <button key={f} onClick={() => { setFFrequency(f); setFDay(f === 'Weekly' ? DAYS_OF_WEEK[0] : '1') }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${fFrequency === f ? 'btn-brand border-transparent' : 'border-slate-900/10 dark:border-white/[0.12] text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  {fFrequency === 'Weekly' ? 'Day of Week' : 'Day of Month'}
                </label>
                <select value={fDay} onChange={e => setFDay(e.target.value)} className={selectClass}>
                  {dayOptions.map(d => (
                    <option key={d} value={d}>{fFrequency === 'Monthly' ? `Day ${d}` : d}</option>
                  ))}
                </select>
              </div>

              {/* Recipients */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Recipients</label>
                <div className="flex gap-2">
                  <input
                    className="input-glass flex-1"
                    type="email"
                    placeholder="email@example.com"
                    value={fEmailInput}
                    onChange={e => setFEmailInput(e.target.value)}
                    onKeyDown={handleEmailKeyDown}
                  />
                  <button onClick={addEmail} className="px-3 py-2.5 rounded-xl border border-slate-900/10 dark:border-white/[0.12] text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-all text-sm whitespace-nowrap">
                    Add
                  </button>
                </div>
                {fRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {fRecipients.map(email => (
                      <span key={email} className="inline-flex items-center gap-1 bg-slate-900/[0.04] dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 text-xs px-2.5 py-1 rounded-full">
                        <Mail className="h-3 w-3 text-slate-500" />
                        {email}
                        <button onClick={() => removeEmail(email)} className="ml-0.5 text-slate-500 hover:text-red-400 transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1.5">Press Enter or comma to add multiple recipients</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-900/10 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-all text-sm font-medium">
                Cancel
              </button>
              <button onClick={handleSchedule} disabled={saving || !fClientId || fRecipients.length === 0}
                className="flex-1 btn-brand py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                Schedule Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
