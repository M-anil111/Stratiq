'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit2, Globe, Mail, Phone, MapPin, ExternalLink, Send, FileText, Plus, Folder, RefreshCw, CheckCircle, Upload, FolderPlus, ChevronRight, Image, Film, Archive } from 'lucide-react'

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400',
  hold: 'bg-amber-500/20 text-amber-400',
  cancelled: 'bg-red-500/20 text-red-400',
  completed: 'bg-slate-500/20 text-slate-400',
  onboarding: 'bg-violet-500/20 text-violet-400',
  prospect: 'bg-blue-500/20 text-blue-400',
}

const TABS = ['Overview', 'Projects', 'Reports', 'Messages', 'Files', 'Integrations']

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [projects, setProjects] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [reports, setReports] = useState<any[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [metaAccounts, setMetaAccounts] = useState<any[]>([])
  const [metaAccountsLoading, setMetaAccountsLoading] = useState(false)
  const [metaAccountsError, setMetaAccountsError] = useState<string | null>(null)
  const [selectedMetaAccount, setSelectedMetaAccount] = useState('')
  const [savedMetaAccount, setSavedMetaAccount] = useState<any>(null)
  const [savingMeta, setSavingMeta] = useState(false)
  const [syncingMeta, setSyncingMeta] = useState(false)
  const [metaSyncDone, setMetaSyncDone] = useState(false)
  const [googleAdsAccounts, setGoogleAdsAccounts] = useState<any[]>([])
  const [googleAdsLoading, setGoogleAdsLoading] = useState(false)
  const [googleAdsError, setGoogleAdsError] = useState<string | null>(null)
  const [selectedGoogleAccount, setSelectedGoogleAccount] = useState('')
  const [savedGoogleAccount, setSavedGoogleAccount] = useState<any>(null)
  const [savingGoogle, setSavingGoogle] = useState(false)
  const [syncingGoogle, setSyncingGoogle] = useState(false)
  const [googleSyncDone, setGoogleSyncDone] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Drive state
  const [driveFiles, setDriveFiles] = useState<any[]>([])
  const [driveFolders, setDriveFolders] = useState<any[]>([])
  const [driveRootId, setDriveRootId] = useState<string | null>(null)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([])
  const [driveLoading, setDriveLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/clients/${params.id}`)
      .then(r => r.json())
      .then(d => { setClient(d); setLoading(false) })
  }, [params.id])

  useEffect(() => {
    if (activeTab === 1) {
      fetch(`/api/clients/${params.id}/projects`).then(r => r.json()).then(setProjects)
    }
    if (activeTab === 3) {
      fetch(`/api/messages?clientId=${params.id}`).then(r => r.json()).then(d => setMessages(d || []))
    }
    if (activeTab === 4) {
      loadDrive(null)
    }
    if (activeTab === 5) {
      // Load existing integrations
      fetch(`/api/clients/${params.id}/integrations`)
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d)) {
            const meta = d.find((i: any) => i.platform === 'meta_ads')
            if (meta) setSavedMetaAccount(meta)
            const google = d.find((i: any) => i.platform === 'google_ads')
            if (google) setSavedGoogleAccount(google)
          }
        })
      // Load Meta accounts
      setMetaAccountsLoading(true)
      setMetaAccountsError(null)
      fetch('/api/integrations/meta-ads/accounts')
        .then(r => r.json())
        .then(d => {
          if (d.error === 'not_connected') {
            setMetaAccountsError('not_connected')
          } else if (d.error) {
            setMetaAccountsError(d.error)
          } else {
            setMetaAccounts(d)
          }
          setMetaAccountsLoading(false)
        })
        .catch(() => { setMetaAccountsError('Failed to load accounts'); setMetaAccountsLoading(false) })
      // Load Google Ads accounts
      setGoogleAdsLoading(true)
      setGoogleAdsError(null)
      fetch('/api/integrations/google-ads/accounts')
        .then(r => r.json())
        .then(d => {
          if (d.error === 'not_connected') {
            setGoogleAdsError('not_connected')
          } else if (d.error) {
            setGoogleAdsError(d.error)
          } else {
            setGoogleAdsAccounts(d)
          }
          setGoogleAdsLoading(false)
        })
        .catch(() => { setGoogleAdsError('Failed to load accounts'); setGoogleAdsLoading(false) })
    }
  }, [activeTab, params.id])

  useEffect(() => {
    if (activeTab === 2) {
      setReportsLoading(true)
      fetch(`/api/clients/${params.id}/reports?month=${selectedMonth}`)
        .then(r => r.json())
        .then(d => { setReports(Array.isArray(d) ? d : []); setReportsLoading(false) })
        .catch(() => setReportsLoading(false))
    }
  }, [activeTab, params.id, selectedMonth])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Drive helpers
  const loadDrive = useCallback(async (folderId: string | null) => {
    setDriveLoading(true)
    try {
      const res = await fetch(`/api/clients/${params.id}/drive`)
      const data = await res.json()
      const rootId = data.folder_id
      setDriveRootId(rootId)
      if (!folderId) {
        setCurrentFolderId(rootId)
        setBreadcrumb([{ id: rootId, name: 'Root' }])
        setDriveFiles(data.files?.filter((f: any) => f.mimeType !== 'application/vnd.google-apps.folder') || [])
        setDriveFolders(data.files?.filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder') || [])
      }
    } catch { /* ignore */ } finally {
      setDriveLoading(false)
    }
  }, [params.id])

  const navigateFolder = async (folderId: string, folderName: string) => {
    setDriveLoading(true)
    try {
      const res = await fetch(`/api/clients/${params.id}/drive?folder_id=${folderId}`)
      const data = await res.json()
      setCurrentFolderId(folderId)
      setBreadcrumb(prev => {
        const idx = prev.findIndex(b => b.id === folderId)
        if (idx !== -1) return prev.slice(0, idx + 1)
        return [...prev, { id: folderId, name: folderName }]
      })
      setDriveFiles(data.files?.filter((f: any) => f.mimeType !== 'application/vnd.google-apps.folder') || [])
      setDriveFolders(data.files?.filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder') || [])
    } catch { /* ignore */ } finally {
      setDriveLoading(false)
    }
  }

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList?.length || uploading) return
    setUploading(true)
    for (const file of Array.from(fileList)) {
      const fd = new FormData()
      fd.append('file', file)
      if (currentFolderId) fd.append('target_folder_id', currentFolderId)
      await fetch(`/api/clients/${params.id}/drive/upload`, { method: 'POST', body: fd })
    }
    setUploading(false)
    // Refresh
    if (currentFolderId && currentFolderId !== driveRootId) {
      await navigateFolder(currentFolderId, breadcrumb[breadcrumb.length - 1]?.name || '')
    } else {
      await loadDrive(null)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || creatingFolder) return
    setCreatingFolder(true)
    await fetch(`/api/clients/${params.id}/drive/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim() }),
    })
    setNewFolderName('')
    setShowNewFolder(false)
    setCreatingFolder(false)
    await loadDrive(null)
  }

  const sendMessage = async () => {
    if (!msgInput.trim() || sending) return
    setSending(true)
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: params.id, content: msgInput }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages(m => [...m, msg])
      setMsgInput('')
    }
    setSending(false)
  }

  if (loading) return (
    <div className="p-4 lg:p-8 space-y-4">
      <div className="h-10 w-48 skeleton rounded-lg" />
      <div className="h-32 skeleton rounded-xl" />
    </div>
  )

  if (!client || client.error) return (
    <div className="p-8 text-center text-slate-400">
      <p className="font-medium">Client not found</p>
      <button onClick={() => router.push('/clients')} className="mt-4 text-sky-400 text-sm">← Back to clients</button>
    </div>
  )

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button onClick={() => router.push('/clients')} className="mt-1 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06]">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white truncate">{client.company_name}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[client.project_status] || 'bg-slate-500/20 text-slate-400'}`}>
              {client.project_status}
            </span>
          </div>
          {client.website && (
            <a href={client.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-sky-400 hover:text-sky-300 mt-1">
              <Globe className="h-3.5 w-3.5" />
              {client.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
        <a href={`/clients/${params.id}/edit`} className="flex items-center gap-2 px-3 py-2 border border-white/[0.08] text-slate-300 text-sm font-medium rounded-lg hover:bg-white/[0.06]">
          <Edit2 className="h-4 w-4" /> Edit
        </a>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.08] mb-6 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === i ? 'bg-white/[0.08] text-white border-b-2 border-sky-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-5 space-y-4">
            <h2 className="font-semibold text-white">Contact & Location</h2>
            {[
              { icon: Mail, label: 'Email', value: client.email },
              { icon: Phone, label: 'Phone', value: client.phone },
              { icon: MapPin, label: 'Address', value: [client.street_address, client.city, client.state, client.country].filter(Boolean).join(', ') },
            ].map(row => row.value ? (
              <div key={row.label} className="flex items-start gap-3">
                <row.icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">{row.label}</p>
                  <p className="text-sm text-slate-300">{row.value}</p>
                </div>
              </div>
            ) : null)}
          </div>

          <div className="glass-card p-5 space-y-4">
            <h2 className="font-semibold text-white">Business Info</h2>
            {[
              { label: 'Industry', value: client.industry },
              { label: 'Company Size', value: client.num_employees ? `${client.num_employees} employees` : null },
              { label: 'Services', value: client.services?.join(', ') },
              { label: 'Advertising Types', value: client.advertising_types?.join(', ') },
              { label: 'Target Audience', value: client.target_audience },
            ].map(row => row.value ? (
              <div key={row.label}>
                <p className="text-xs text-slate-400">{row.label}</p>
                <p className="text-sm text-slate-300">{row.value}</p>
              </div>
            ) : null)}
          </div>

          <div className="glass-card p-5 space-y-3">
            <h2 className="font-semibold text-white">Team</h2>
            {client.sales_manager && (
              <div>
                <p className="text-xs text-slate-400">Sales Manager</p>
                <p className="text-sm font-medium text-slate-300">{client.sales_manager.full_name}</p>
              </div>
            )}
            {client.dm_manager && (
              <div>
                <p className="text-xs text-slate-400">DM Manager</p>
                <p className="text-sm font-medium text-slate-300">{client.dm_manager.full_name}</p>
              </div>
            )}
          </div>

          <div className="glass-card p-5 space-y-3">
            <h2 className="font-semibold text-white">Links</h2>
            {client.google_drive_folder_url && (
              <a href={client.google_drive_folder_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300">
                <ExternalLink className="h-3.5 w-3.5" /> Google Drive Folder
              </a>
            )}
            {client.ndisk_link && (
              <a href={client.ndisk_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300">
                <ExternalLink className="h-3.5 w-3.5" /> nDisk
              </a>
            )}
          </div>
        </div>
      )}

      {/* Projects */}
      {activeTab === 1 && (
        <div>
          <div className="flex justify-end mb-4">
            <a href={`/clients/${params.id}/projects/new`} className="btn-brand flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg">
              <Plus className="h-4 w-4" /> Add Project
            </a>
          </div>
          {projects.length === 0 ? (
            <div className="glass-card p-12 text-center text-slate-400">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No projects yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map(p => (
                <a key={p.id} href={`/clients/${params.id}/projects/${p.id}`} className="flex items-center justify-between glass-card p-4 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-white">{p.domain}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] || ''}`}>{p.status}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reports */}
      {activeTab === 2 && (() => {
        const googleData = reports.find(r => r.channel === 'google_ads')
        const metaData = reports.find(r => r.channel === 'meta_ads')
        const now = new Date()
        const monthOptions: string[] = []
        for (let i = 0; i < 6; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
        }
        const fmtNum = (v: any) => v != null ? Number(v).toLocaleString() : '—'
        const fmtMoney = (v: any) => v != null ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
        const fmtPct = (v: any) => v != null ? `${Number(v).toFixed(2)}%` : '—'
        const fmtRoas = (v: any) => v != null ? `${Number(v).toFixed(2)}x` : '—'
        return (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-300">Marketing Reports</h2>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                {monthOptions.map(m => {
                  const [y, mo] = m.split('-')
                  const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  return <option key={m} value={m}>{label}</option>
                })}
              </select>
            </div>
            {reportsLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[0, 1].map(i => <div key={i} className="h-48 skeleton rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Google Ads */}
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-sky-400 mb-4">Google Ads</h3>
                  {googleData ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Impressions', value: fmtNum(googleData.impressions) },
                        { label: 'Clicks', value: fmtNum(googleData.clicks) },
                        { label: 'Conversions', value: fmtNum(googleData.conversions) },
                        { label: 'Spend', value: fmtMoney(googleData.spend) },
                        { label: 'CTR', value: googleData.ctr != null ? fmtPct(googleData.ctr) : (googleData.impressions && googleData.clicks ? fmtPct((googleData.clicks / googleData.impressions) * 100) : '—') },
                      ].map(row => (
                        <div key={row.label} className="page-card rounded-lg p-3 border border-white/[0.05]">
                          <p className="text-xs text-slate-400">{row.label}</p>
                          <p className="text-sm font-semibold text-white mt-0.5">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No data synced yet</div>
                  )}
                </div>
                {/* Meta Ads */}
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-sky-400 mb-4">Meta Ads</h3>
                  {metaData ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Impressions', value: fmtNum(metaData.impressions) },
                        { label: 'Clicks', value: fmtNum(metaData.clicks) },
                        { label: 'Spend', value: fmtMoney(metaData.spend) },
                        { label: 'ROAS', value: fmtRoas(metaData.roas) },
                      ].map(row => (
                        <div key={row.label} className="page-card rounded-lg p-3 border border-white/[0.05]">
                          <p className="text-xs text-slate-400">{row.label}</p>
                          <p className="text-sm font-semibold text-white mt-0.5">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No data synced yet</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Messages */}
      {activeTab === 3 && (
        <div className="flex flex-col h-[500px] glass-card overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">No messages yet</div>
            ) : messages.map(msg => {
              const isStaff = msg.sender_type === 'staff'
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isStaff ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isStaff ? 'bg-sky-500/20 text-sky-400' : 'bg-white/[0.08] text-slate-400'}`}>
                    {(msg.sender_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                  </div>
                  <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${isStaff ? 'bg-sky-500 text-white rounded-br-sm' : 'bg-white/[0.08] text-slate-300 rounded-bl-sm'}`}>
                    {!isStaff && <p className="text-xs font-medium mb-0.5 text-slate-400">{msg.sender_name}</p>}
                    <p>{msg.content}</p>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t border-white/[0.08] flex gap-2">
            <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              className="input-glass flex-1"
              placeholder="Message client..." />
            <button onClick={sendMessage} disabled={!msgInput.trim() || sending}
              className="btn-brand p-2 disabled:opacity-50 rounded-lg">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Integrations */}
      {activeTab === 5 && (
        <div className="max-w-2xl space-y-6">
          {/* Google Ads */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl">🔵</span>
              <div>
                <h2 className="font-semibold text-white">Google Ads</h2>
                <p className="text-xs text-slate-400">Map a Google Ads customer account to sync campaign data for this client</p>
              </div>
              {savedGoogleAccount && (
                <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                  <CheckCircle className="h-3 w-3" /> Mapped
                </span>
              )}
            </div>

            {googleAdsError === 'not_connected' ? (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-300">
                Google Ads is not connected yet.{' '}
                <a href="/settings/integrations" className="underline hover:text-amber-200">Connect it in Settings → Integrations</a>
              </div>
            ) : googleAdsLoading ? (
              <div className="h-10 skeleton rounded-lg" />
            ) : googleAdsError ? (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{googleAdsError}</div>
            ) : (
              <div className="space-y-3">
                {savedGoogleAccount && (
                  <div className="text-xs text-slate-400">
                    Current: <span className="text-slate-300 font-medium">{savedGoogleAccount.ad_account_name || savedGoogleAccount.ad_account_id}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <select
                    value={selectedGoogleAccount}
                    onChange={e => setSelectedGoogleAccount(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  >
                    <option value="">Select customer account…</option>
                    {googleAdsAccounts.map(a => (
                      <option key={a.customer_id} value={a.customer_id}>{a.name || a.descriptive_name || a.customer_id} ({a.customer_id})</option>
                    ))}
                  </select>
                  <button
                    disabled={!selectedGoogleAccount || savingGoogle}
                    onClick={async () => {
                      setSavingGoogle(true)
                      const account = googleAdsAccounts.find(a => a.customer_id === selectedGoogleAccount)
                      const res = await fetch(`/api/clients/${params.id}/integrations`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          platform: 'google_ads',
                          ad_account_id: selectedGoogleAccount,
                          ad_account_name: account?.name || account?.descriptive_name,
                        }),
                      })
                      if (res.ok) {
                        const saved = await res.json()
                        setSavedGoogleAccount(saved)
                        setSelectedGoogleAccount('')
                      }
                      setSavingGoogle(false)
                    }}
                    className="btn-brand px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 whitespace-nowrap"
                  >
                    {savingGoogle ? 'Saving…' : 'Save'}
                  </button>
                </div>

                {savedGoogleAccount && (
                  <button
                    disabled={syncingGoogle}
                    onClick={async () => {
                      setSyncingGoogle(true)
                      setGoogleSyncDone(false)
                      const now = new Date()
                      const y = now.getFullYear()
                      const m = now.getMonth() + 1
                      const period_start = `${y}-${String(m).padStart(2, '0')}-01`
                      const lastDay = new Date(y, m, 0).getDate()
                      const period_end = `${y}-${String(m).padStart(2, '0')}-${lastDay}`
                      await fetch('/api/integrations/google-ads/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          client_id: params.id,
                          customer_id: savedGoogleAccount.ad_account_id,
                          period_start,
                          period_end,
                        }),
                      })
                      setSyncingGoogle(false)
                      setGoogleSyncDone(true)
                      setTimeout(() => setGoogleSyncDone(false), 3000)
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncingGoogle ? 'animate-spin' : ''}`} />
                    {syncingGoogle ? 'Syncing…' : googleSyncDone ? 'Synced!' : 'Sync Now'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Meta Ads */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl">🔷</span>
              <div>
                <h2 className="font-semibold text-white">Meta Ads</h2>
                <p className="text-xs text-slate-400">Connect a Meta ad account to sync campaign data for this client</p>
              </div>
              {savedMetaAccount && (
                <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                  <CheckCircle className="h-3 w-3" /> Mapped
                </span>
              )}
            </div>

            {metaAccountsError === 'not_connected' ? (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-300">
                Meta Ads is not connected yet.{' '}
                <a href="/settings/integrations" className="underline hover:text-amber-200">Connect it in Settings → Integrations</a>
              </div>
            ) : metaAccountsLoading ? (
              <div className="h-10 skeleton rounded-lg" />
            ) : metaAccountsError ? (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{metaAccountsError}</div>
            ) : (
              <div className="space-y-3">
                {savedMetaAccount && (
                  <div className="text-xs text-slate-400">
                    Current: <span className="text-slate-300 font-medium">{savedMetaAccount.ad_account_name || savedMetaAccount.ad_account_id}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <select
                    value={selectedMetaAccount}
                    onChange={e => setSelectedMetaAccount(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  >
                    <option value="">Select ad account…</option>
                    {metaAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                    ))}
                  </select>
                  <button
                    disabled={!selectedMetaAccount || savingMeta}
                    onClick={async () => {
                      setSavingMeta(true)
                      const account = metaAccounts.find(a => a.id === selectedMetaAccount)
                      const res = await fetch(`/api/clients/${params.id}/integrations`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          platform: 'meta_ads',
                          ad_account_id: selectedMetaAccount,
                          ad_account_name: account?.name,
                        }),
                      })
                      if (res.ok) {
                        const saved = await res.json()
                        setSavedMetaAccount(saved)
                        setSelectedMetaAccount('')
                      }
                      setSavingMeta(false)
                    }}
                    className="btn-brand px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 whitespace-nowrap"
                  >
                    {savingMeta ? 'Saving…' : 'Save'}
                  </button>
                </div>

                {savedMetaAccount && (
                  <button
                    disabled={syncingMeta}
                    onClick={async () => {
                      setSyncingMeta(true)
                      setMetaSyncDone(false)
                      const now = new Date()
                      const y = now.getFullYear()
                      const m = now.getMonth() + 1
                      const period_start = `${y}-${String(m).padStart(2, '0')}-01`
                      const lastDay = new Date(y, m, 0).getDate()
                      const period_end = `${y}-${String(m).padStart(2, '0')}-${lastDay}`
                      await fetch('/api/integrations/meta-ads/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          client_id: params.id,
                          ad_account_id: savedMetaAccount.ad_account_id,
                          period_start,
                          period_end,
                        }),
                      })
                      setSyncingMeta(false)
                      setMetaSyncDone(true)
                      setTimeout(() => setMetaSyncDone(false), 3000)
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncingMeta ? 'animate-spin' : ''}`} />
                    {syncingMeta ? 'Syncing…' : metaSyncDone ? 'Synced!' : 'Sync Now'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Files */}
      {activeTab === 4 && (
        <div>
          {files.length === 0 ? (
            <div className="glass-card p-12 text-center text-slate-400">
              <Folder className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No files yet</p>
              <p className="text-sm mt-1">Files uploaded to Google Drive for this client will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {files.map(file => (
                <div key={file.id} className="glass-card p-4 flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8 text-slate-400" />
                  <p className="text-xs font-medium text-slate-300 text-center line-clamp-2">{file.name}</p>
                  <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:text-sky-300">Open</a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
