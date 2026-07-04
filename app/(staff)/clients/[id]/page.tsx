'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Edit2, Globe, Mail, Phone, MapPin, ExternalLink, Send, FileText,
  Plus, Folder, RefreshCw, CheckCircle, FolderPlus, ChevronRight,
  CheckSquare, Square, Circle, MessageSquare, PhoneCall, Users, Calendar,
  Loader2, X, ChevronDown, AlertCircle, ClipboardList,
} from 'lucide-react'

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400',
  hold: 'bg-amber-500/20 text-amber-400',
  on_hold: 'bg-amber-500/20 text-amber-400',
  cancelled: 'bg-red-500/20 text-red-400',
  completed: 'bg-slate-500/20 text-slate-400',
  onboarding: 'bg-violet-500/20 text-violet-400',
  in_onboarding: 'bg-violet-500/20 text-violet-400',
  prospect: 'bg-blue-500/20 text-blue-400',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-slate-400',
  medium: 'text-sky-400',
  high: 'text-amber-400',
  urgent: 'text-red-400',
}

const NOTE_ICONS: Record<string, any> = {
  note: FileText,
  call: PhoneCall,
  email: Mail,
  meeting: Users,
  activity: ClipboardList,
}

const TABS = ['Overview', 'Tasks', 'Notes', 'Reports', 'Messages', 'Files', 'Integrations']

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [projects, setProjects] = useState<any[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)

  // Tasks
  const [tasks, setTasks] = useState<any[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium', due_date: '', description: '' })
  const [savingTask, setSavingTask] = useState(false)

  // Notes
  const [notes, setNotes] = useState<any[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [noteType, setNoteType] = useState('note')
  const [savingNote, setSavingNote] = useState(false)

  // Messages
  const [messages, setMessages] = useState<any[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Reports
  const [reports, setReports] = useState<any[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Integrations
  const [metaAccounts, setMetaAccounts] = useState<any[]>([])
  const [metaAccountsLoading, setMetaAccountsLoading] = useState(false)
  const [metaAccountsError, setMetaAccountsError] = useState<string | null>(null)
  const [selectedMetaAccount, setSelectedMetaAccount] = useState('')
  const [savedMetaAccount, setSavedMetaAccount] = useState<any>(null)
  const [savingMeta, setSavingMeta] = useState(false)
  const [syncingMeta, setSyncingMeta] = useState(false)
  const [metaSyncDone, setMetaSyncDone] = useState(false)
  const [qbCustomers, setQbCustomers] = useState<any[]>([])
  const [qbCustomersLoading, setQbCustomersLoading] = useState(false)
  const [qbCustomersError, setQbCustomersError] = useState<string | null>(null)
  const [selectedQbCustomer, setSelectedQbCustomer] = useState('')
  const [savedQbCustomer, setSavedQbCustomer] = useState<any>(null)
  const [savingQb, setSavingQb] = useState(false)
  const [googleAdsAccounts, setGoogleAdsAccounts] = useState<any[]>([])
  const [googleAdsLoading, setGoogleAdsLoading] = useState(false)
  const [googleAdsError, setGoogleAdsError] = useState<string | null>(null)
  const [selectedGoogleAccount, setSelectedGoogleAccount] = useState('')
  const [savedGoogleAccount, setSavedGoogleAccount] = useState<any>(null)
  const [savingGoogle, setSavingGoogle] = useState(false)
  const [syncingGoogle, setSyncingGoogle] = useState(false)
  const [googleSyncDone, setGoogleSyncDone] = useState(false)

  // Drive
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

  // New+ dropdown
  const [showNewMenu, setShowNewMenu] = useState(false)
  const newMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/clients/${params.id}`)
      .then(r => r.json())
      .then(d => { setClient(d); setLoading(false) })
  }, [params.id])

  // Load projects on Overview tab
  useEffect(() => {
    if (activeTab === 0) {
      setProjectsLoading(true)
      fetch(`/api/clients/${params.id}/projects`)
        .then(r => r.json())
        .then(d => { setProjects(Array.isArray(d) ? d : []); setProjectsLoading(false) })
        .catch(() => setProjectsLoading(false))
    }
    if (activeTab === 1) {
      setTasksLoading(true)
      fetch(`/api/clients/${params.id}/tasks`)
        .then(r => r.json())
        .then(d => { setTasks(Array.isArray(d) ? d : []); setTasksLoading(false) })
        .catch(() => setTasksLoading(false))
    }
    if (activeTab === 2) {
      setNotesLoading(true)
      fetch(`/api/clients/${params.id}/notes`)
        .then(r => r.json())
        .then(d => { setNotes(Array.isArray(d) ? d : []); setNotesLoading(false) })
        .catch(() => setNotesLoading(false))
    }
    if (activeTab === 3) {
      setReportsLoading(true)
      fetch(`/api/clients/${params.id}/reports?month=${selectedMonth}`)
        .then(r => r.json())
        .then(d => { setReports(Array.isArray(d) ? d : []); setReportsLoading(false) })
        .catch(() => setReportsLoading(false))
    }
    if (activeTab === 4) {
      fetch(`/api/messages?clientId=${params.id}`).then(r => r.json()).then(d => setMessages(d || []))
    }
    if (activeTab === 5) {
      loadDrive(null)
    }
    if (activeTab === 6) {
      fetch(`/api/clients/${params.id}/integrations`).then(r => r.json()).then(d => {
        if (Array.isArray(d)) {
          const meta = d.find((i: any) => i.platform === 'meta_ads'); if (meta) setSavedMetaAccount(meta)
          const google = d.find((i: any) => i.platform === 'google_ads'); if (google) setSavedGoogleAccount(google)
          const qb = d.find((i: any) => i.platform === 'quickbooks'); if (qb) setSavedQbCustomer(qb)
        }
      })
      setMetaAccountsLoading(true)
      fetch('/api/integrations/meta-ads/accounts').then(r => r.json()).then(d => {
        if (d.error === 'not_connected') setMetaAccountsError('not_connected')
        else if (d.error) setMetaAccountsError(d.error)
        else setMetaAccounts(d)
        setMetaAccountsLoading(false)
      }).catch(() => { setMetaAccountsError('Failed to load'); setMetaAccountsLoading(false) })
      setQbCustomersLoading(true)
      fetch('/api/integrations/quickbooks/customers').then(r => r.json()).then(d => {
        if (d.error === 'not_connected') setQbCustomersError('not_connected')
        else if (d.error) setQbCustomersError(d.error)
        else setQbCustomers(d)
        setQbCustomersLoading(false)
      }).catch(() => { setQbCustomersError('Failed to load'); setQbCustomersLoading(false) })
      setGoogleAdsLoading(true)
      fetch('/api/integrations/google-ads/accounts').then(r => r.json()).then(d => {
        if (d.error === 'not_connected') setGoogleAdsError('not_connected')
        else if (d.error) setGoogleAdsError(d.error)
        else setGoogleAdsAccounts(d)
        setGoogleAdsLoading(false)
      }).catch(() => { setGoogleAdsError('Failed to load'); setGoogleAdsLoading(false) })
    }
  }, [activeTab, params.id])

  useEffect(() => {
    if (activeTab === 3) {
      setReportsLoading(true)
      fetch(`/api/clients/${params.id}/reports?month=${selectedMonth}`)
        .then(r => r.json())
        .then(d => { setReports(Array.isArray(d) ? d : []); setReportsLoading(false) })
        .catch(() => setReportsLoading(false))
    }
  }, [selectedMonth])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setShowNewMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
    } catch { } finally { setDriveLoading(false) }
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
    } catch { } finally { setDriveLoading(false) }
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim() }),
    })
    setNewFolderName(''); setShowNewFolder(false); setCreatingFolder(false)
    await loadDrive(null)
  }

  const sendMessage = async () => {
    if (!msgInput.trim() || sending) return
    setSending(true)
    const res = await fetch('/api/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: params.id, content: msgInput }),
    })
    if (res.ok) { const msg = await res.json(); setMessages(m => [...m, msg]); setMsgInput('') }
    setSending(false)
  }

  const addTask = async () => {
    if (!newTask.title.trim() || savingTask) return
    setSavingTask(true)
    const res = await fetch(`/api/clients/${params.id}/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask),
    })
    if (res.ok) {
      const t = await res.json()
      setTasks(prev => [t, ...prev])
      setNewTask({ title: '', priority: 'medium', due_date: '', description: '' })
      setShowAddTask(false)
    }
    setSavingTask(false)
  }

  const toggleTask = async (task: any) => {
    const nextStatus = task.status === 'done' ? 'open' : 'done'
    const res = await fetch(`/api/clients/${params.id}/tasks`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, status: nextStatus }),
    })
    if (res.ok) setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t))
  }

  const addNote = async () => {
    if (!noteInput.trim() || savingNote) return
    setSavingNote(true)
    const res = await fetch(`/api/clients/${params.id}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: noteInput, type: noteType }),
    })
    if (res.ok) {
      const n = await res.json()
      setNotes(prev => [n, ...prev])
      setNoteInput('')
    }
    setSavingNote(false)
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

  const pkgs: any[] = client.service_packages || []
  const monthlyRevenue = pkgs.reduce((s: number, p: any) => s + (parseFloat(p.price) || 0), 0)
  const setupTotal = pkgs.reduce((s: number, p: any) => s + (parseFloat(p.setup_fee) || 0), 0)
  const openTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length

  const sel = "w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

  return (
    <div className="p-4 lg:p-8">
      {/* Back + actions */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <button onClick={() => router.push('/clients')} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm shrink-0">
          <ArrowLeft className="h-4 w-4" /> All Clients
        </button>
        <div className="flex items-center gap-2">
          {/* New+ split button */}
          <div ref={newMenuRef} className="relative flex">
            <button onClick={() => setActiveTab(1)}
              className="flex items-center gap-2 px-3 py-2 btn-brand text-sm font-medium rounded-l-lg border-r border-white/20">
              <Plus className="h-4 w-4" /> New
            </button>
            <button onClick={() => setShowNewMenu(v => !v)}
              className="px-2 py-2 btn-brand text-sm font-medium rounded-r-lg">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {showNewMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-xl border border-white/[0.12] bg-[#0f1929] shadow-2xl overflow-hidden">
                {[
                  { label: 'Add Task', icon: CheckSquare, action: () => { setActiveTab(1); setShowAddTask(true); setShowNewMenu(false) } },
                  { label: 'Log Note', icon: FileText, action: () => { setActiveTab(2); setShowNewMenu(false) } },
                  { label: 'Log Call', icon: PhoneCall, action: () => { setActiveTab(2); setNoteType('call'); setShowNewMenu(false) } },
                  { label: 'Log Meeting', icon: Users, action: () => { setActiveTab(2); setNoteType('meeting'); setShowNewMenu(false) } },
                  { label: 'Send Message', icon: MessageSquare, action: () => { setActiveTab(4); setShowNewMenu(false) } },
                ].map(m => (
                  <button key={m.label} type="button" onClick={m.action}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.06] border-b border-white/[0.05] last:border-0 transition-colors">
                    <m.icon className="h-4 w-4 text-slate-500" />{m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <a href={`/clients/${params.id}/edit`}
            className="flex items-center gap-2 px-3 py-2 border border-white/[0.08] text-slate-300 text-sm font-medium rounded-lg hover:bg-white/[0.06]">
            <Edit2 className="h-4 w-4" /> Edit
          </a>
        </div>
      </div>

      {/* Client Header Card */}
      <div className="glass-card mb-6 overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.08]">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-bold text-white">{client.display_name || client.company_name}</h1>
                {client.display_name && client.display_name !== client.company_name && (
                  <span className="text-sm text-slate-400">{client.company_name}</span>
                )}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[client.project_status] || 'bg-slate-500/20 text-slate-400'}`}>
                  {client.project_status?.replace(/_/g, ' ')}
                </span>
              </div>
              {(client.contact_first_name || client.contact_last_name) && (
                <p className="text-sm text-slate-400 mb-1.5">Contact: <span className="text-slate-300">{[client.contact_first_name, client.contact_last_name].filter(Boolean).join(' ')}</span></p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                {client.website && (
                  <a href={`https://${client.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-400 hover:text-sky-300">
                    <Globe className="h-3.5 w-3.5" />{client.website}
                  </a>
                )}
                {client.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
                {client.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
                {(client.city || client.state) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />{[client.city, client.state].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/[0.06]">
          {[
            { label: 'Active Services', value: pkgs.length || client.services?.length || 0, color: 'text-sky-400' },
            { label: 'Monthly Revenue', value: monthlyRevenue > 0 ? `$${monthlyRevenue.toLocaleString()}` : '—', color: 'text-emerald-400' },
            { label: 'Setup Fees', value: setupTotal > 0 ? `$${setupTotal.toLocaleString()}` : '—', color: 'text-amber-400' },
            { label: 'Open Tasks', value: openTasks || '—', color: openTasks > 0 ? 'text-violet-400' : 'text-slate-400' },
          ].map(s => (
            <div key={s.label} className="px-5 py-4">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.color} truncate`}>{String(s.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.08] mb-6 overflow-x-auto gap-0">
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors relative ${activeTab === i ? 'text-white border-sky-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {tab}
            {tab === 'Tasks' && openTasks > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-violet-500/30 text-violet-300">{openTasks}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 0 && (
        <div className="space-y-6">
          {/* Active Projects */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
              <div>
                <h2 className="font-semibold text-white">Active Projects</h2>
                <p className="text-xs text-slate-500 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
              </div>
              <a href={`/clients/${params.id}/projects/new`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium btn-brand rounded-lg">
                <Plus className="h-3.5 w-3.5" /> Add Project
              </a>
            </div>
            {projectsLoading ? (
              <div className="p-5 space-y-2">{[0,1].map(i => <div key={i} className="h-12 skeleton rounded-lg" />)}</div>
            ) : projects.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Globe className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No projects yet</p>
                <a href={`/clients/${params.id}/projects/new`} className="text-sky-400 text-xs mt-1 inline-block hover:text-sky-300">Create first project →</a>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {projects.map((p, idx) => (
                  <a key={p.id} href={`/clients/${params.id}/projects/${p.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors group">
                    <div className="w-7 h-7 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-xs shrink-0">{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white group-hover:text-sky-300 transition-colors truncate">{p.domain}</p>
                      {p.services?.length > 0 && <p className="text-xs text-slate-500 truncate">{p.services.join(' · ')}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColors[p.status] || 'bg-slate-500/20 text-slate-400'}`}>
                      {p.status?.replace(/_/g, ' ')}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Service Packages */}
          {pkgs.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="font-semibold text-white mb-4">Service Packages</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08]">
                      <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Service</th>
                      <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Billing</th>
                      <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Contract</th>
                      <th className="text-right py-2 px-3 text-xs text-slate-500 font-medium">Monthly</th>
                      <th className="text-right py-2 px-3 text-xs text-slate-500 font-medium">Setup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pkgs.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                            <span className="text-slate-200 font-medium">{p.service}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{p.billing_term || '—'}</td>
                        <td className="py-3 px-3 text-slate-400">{p.contract_term || '—'}</td>
                        <td className="py-3 px-3 text-right text-sky-400 font-semibold">
                          {p.price ? `$${parseFloat(p.price).toLocaleString()}` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-400">
                          {p.setup_fee && parseFloat(p.setup_fee) > 0 ? `$${parseFloat(p.setup_fee).toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/[0.08] bg-white/[0.02]">
                      <td colSpan={3} className="py-3 px-3 text-slate-400 text-xs font-medium">Total</td>
                      <td className="py-3 px-3 text-right text-emerald-400 font-bold">${monthlyRevenue.toLocaleString()}/mo</td>
                      <td className="py-3 px-3 text-right text-slate-300 font-semibold">{setupTotal > 0 ? `$${setupTotal.toLocaleString()}` : '—'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contact */}
            <div className="glass-card p-5 space-y-4">
              <h2 className="font-semibold text-sm uppercase tracking-wider text-sky-400">Contact</h2>
              {client.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <a href={`mailto:${client.email}`} className="text-sm text-sky-400 hover:text-sky-300">{client.email}</a>
                  </div>
                </div>
              )}
              {client.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <a href={`tel:${client.phone}`} className="text-sm text-slate-300 hover:text-white">{client.phone}</a>
                  </div>
                </div>
              )}
              {[client.street_address, client.city, client.state, client.country].some(Boolean) && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Address</p>
                    <p className="text-sm text-slate-300">{[client.street_address, client.city, client.state, client.country].filter(Boolean).join(', ')}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Business */}
            <div className="glass-card p-5 space-y-4">
              <h2 className="font-semibold text-sm uppercase tracking-wider text-sky-400">Business</h2>
              {[
                { label: 'Industry', value: client.industry },
                { label: 'Employees', value: client.num_employees ? `${client.num_employees}` : null },
                { label: 'Target Audience', value: client.target_audience },
              ].map(row => row.value ? (
                <div key={row.label}>
                  <p className="text-xs text-slate-500">{row.label}</p>
                  <p className="text-sm text-slate-300">{row.value}</p>
                </div>
              ) : null)}
              {client.goals?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1.5">Goals</p>
                  <div className="flex flex-wrap gap-1.5">
                    {client.goals.map((g: string) => (
                      <span key={g} className="px-2 py-0.5 rounded-full text-xs bg-sky-500/10 text-sky-300 border border-sky-500/20">{g}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Team & Links */}
            <div className="glass-card p-5 space-y-4">
              <h2 className="font-semibold text-sm uppercase tracking-wider text-sky-400">Team & Links</h2>
              {client.sales_manager && (
                <div>
                  <p className="text-xs text-slate-500">Sales Manager</p>
                  <p className="text-sm font-medium text-slate-300">{client.sales_manager.full_name}</p>
                  {client.sales_manager.email && <p className="text-xs text-slate-500">{client.sales_manager.email}</p>}
                </div>
              )}
              {client.dm_manager && (
                <div>
                  <p className="text-xs text-slate-500">DM Manager</p>
                  <p className="text-sm font-medium text-slate-300">{client.dm_manager.full_name}</p>
                </div>
              )}
              <div className="pt-2 space-y-2">
                {client.google_drive_folder_url && (
                  <a href={client.google_drive_folder_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300">
                    <ExternalLink className="h-3.5 w-3.5" /> Google Drive
                  </a>
                )}
                {client.ndisk_link && (
                  <a href={client.ndisk_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300">
                    <ExternalLink className="h-3.5 w-3.5" /> nDisk
                  </a>
                )}
                {client.proposal_url && (
                  <a href={client.proposal_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300">
                    <FileText className="h-3.5 w-3.5" /> Proposal
                  </a>
                )}
              </div>
            </div>
          </div>

          {client.about_company && (
            <div className="glass-card p-5">
              <h2 className="font-semibold text-sm uppercase tracking-wider text-sky-400 mb-3">About</h2>
              <p className="text-sm text-slate-300 leading-relaxed">{client.about_company}</p>
            </div>
          )}
        </div>
      )}

      {/* ── TASKS ── */}
      {activeTab === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Tasks</h2>
              <p className="text-xs text-slate-500 mt-0.5">{openTasks} open · {tasks.filter(t => t.status === 'done').length} done</p>
            </div>
            <button onClick={() => setShowAddTask(v => !v)}
              className="flex items-center gap-2 px-3 py-2 btn-brand text-sm font-medium rounded-lg">
              <Plus className="h-4 w-4" /> Add Task
            </button>
          </div>

          {showAddTask && (
            <div className="glass-card p-5 space-y-4 border border-sky-500/20">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-white">New Task</p>
                <button onClick={() => setShowAddTask(false)}><X className="h-4 w-4 text-slate-500" /></button>
              </div>
              <input className="input-glass w-full" placeholder="Task title…" autoFocus
                value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addTask()} />
              <textarea className="input-glass w-full min-h-[60px] resize-none" placeholder="Description (optional)"
                value={newTask.description} onChange={e => setNewTask(t => ({ ...t, description: e.target.value }))} />
              <div className="flex gap-3">
                <select className="flex-1 bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  value={newTask.priority} onChange={e => setNewTask(t => ({ ...t, priority: e.target.value }))}>
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
                <input type="date" className="flex-1 bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  value={newTask.due_date} onChange={e => setNewTask(t => ({ ...t, due_date: e.target.value }))} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddTask(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-white/[0.08] rounded-lg">Cancel</button>
                <button onClick={addTask} disabled={!newTask.title.trim() || savingTask}
                  className="px-4 py-2 text-sm btn-brand font-medium rounded-lg disabled:opacity-50 flex items-center gap-2">
                  {savingTask && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Task
                </button>
              </div>
            </div>
          )}

          {tasksLoading ? (
            <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
          ) : tasks.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <CheckSquare className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No tasks yet</p>
              <button onClick={() => setShowAddTask(true)} className="text-sky-400 text-xs mt-1 hover:text-sky-300">Add the first task →</button>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              {/* Open tasks */}
              {tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').map(task => (
                <div key={task.id} className="flex items-start gap-4 px-5 py-4 border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors">
                  <button onClick={() => toggleTask(task)} className="mt-0.5 shrink-0">
                    <Circle className="h-5 w-5 text-slate-600 hover:text-sky-400 transition-colors" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{task.title}</p>
                    {task.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{task.description}</p>}
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                      {task.due_date && (
                        <span className={`text-xs flex items-center gap-1 ${new Date(task.due_date) < new Date() ? 'text-red-400' : 'text-slate-500'}`}>
                          <Calendar className="h-3 w-3" /> {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {task.assigned_user && <span className="text-xs text-slate-500">{task.assigned_user.full_name}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {/* Done tasks */}
              {tasks.filter(t => t.status === 'done').map(task => (
                <div key={task.id} className="flex items-start gap-4 px-5 py-3 border-b border-white/[0.03] opacity-50 hover:opacity-70 transition-opacity">
                  <button onClick={() => toggleTask(task)} className="mt-0.5 shrink-0">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  </button>
                  <p className="text-sm text-slate-400 line-through">{task.title}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── NOTES / ACTIVITY ── */}
      {activeTab === 2 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white">Notes & Activity</h2>

          {/* Log note input */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex gap-2">
              {[
                { value: 'note', label: 'Note', icon: FileText },
                { value: 'call', label: 'Call', icon: PhoneCall },
                { value: 'email', label: 'Email', icon: Mail },
                { value: 'meeting', label: 'Meeting', icon: Users },
              ].map(t => (
                <button key={t.value} type="button" onClick={() => setNoteType(t.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${noteType === t.value ? 'border-sky-500 bg-sky-500/10 text-sky-400' : 'border-white/[0.08] text-slate-400 hover:border-white/20'}`}>
                  <t.icon className="h-3.5 w-3.5" />{t.label}
                </button>
              ))}
            </div>
            <textarea className="input-glass w-full min-h-[80px] resize-none"
              placeholder={noteType === 'call' ? 'What was discussed on the call?' : noteType === 'meeting' ? 'Meeting notes…' : noteType === 'email' ? 'Email summary…' : 'Add a note…'}
              value={noteInput} onChange={e => setNoteInput(e.target.value)} />
            <div className="flex justify-end">
              <button onClick={addNote} disabled={!noteInput.trim() || savingNote}
                className="px-4 py-2 text-sm btn-brand font-medium rounded-lg disabled:opacity-50 flex items-center gap-2">
                {savingNote && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Log {noteType.charAt(0).toUpperCase() + noteType.slice(1)}
              </button>
            </div>
          </div>

          {notesLoading ? (
            <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="h-20 skeleton rounded-xl" />)}</div>
          ) : notes.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <MessageSquare className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No notes yet — log a call, meeting, or note above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(note => {
                const Icon = NOTE_ICONS[note.type] || FileText
                return (
                  <div key={note.id} className="glass-card p-4 flex gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${note.type === 'call' ? 'bg-emerald-500/10 text-emerald-400' : note.type === 'meeting' ? 'bg-violet-500/10 text-violet-400' : note.type === 'email' ? 'bg-sky-500/10 text-sky-400' : 'bg-white/[0.06] text-slate-400'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-slate-300">{note.created_by_name || 'Staff'}</span>
                        <span className="text-xs text-slate-600">·</span>
                        <span className="text-xs text-slate-500 capitalize">{note.type}</span>
                        <span className="text-xs text-slate-600">·</span>
                        <span className="text-xs text-slate-500">{new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{note.body}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── REPORTS ── */}
      {activeTab === 3 && (() => {
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
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                className="bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50">
                {monthOptions.map(m => {
                  const [y, mo] = m.split('-')
                  const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  return <option key={m} value={m}>{label}</option>
                })}
              </select>
            </div>
            {reportsLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[0,1].map(i => <div key={i} className="h-48 skeleton rounded-xl" />)}</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                        <div key={row.label} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                          <p className="text-xs text-slate-400">{row.label}</p>
                          <p className="text-sm font-semibold text-white mt-0.5">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No data synced yet</div>}
                </div>
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
                        <div key={row.label} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                          <p className="text-xs text-slate-400">{row.label}</p>
                          <p className="text-sm font-semibold text-white mt-0.5">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No data synced yet</div>}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── MESSAGES ── */}
      {activeTab === 4 && (
        <div className="flex flex-col h-[500px] glass-card overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">No messages yet</div>
            ) : messages.map(msg => {
              const isStaff = msg.sender_type === 'staff'
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isStaff ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isStaff ? 'bg-sky-500/20 text-sky-400' : 'bg-white/[0.08] text-slate-400'}`}>
                    {(msg.sender_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
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
              className="input-glass flex-1" placeholder="Message client..." />
            <button onClick={sendMessage} disabled={!msgInput.trim() || sending}
              className="btn-brand p-2 disabled:opacity-50 rounded-lg">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── FILES (Drive) ── */}
      {activeTab === 5 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              {breadcrumb.map((b, i) => (
                <span key={b.id} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-600" />}
                  <button onClick={() => navigateFolder(b.id, b.name)} className={i === breadcrumb.length - 1 ? 'text-white' : 'hover:text-white'}>{b.name}</button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {showNewFolder ? (
                <div className="flex gap-2">
                  <input className="input-glass text-sm py-1.5 px-3 w-40" placeholder="Folder name" autoFocus
                    value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} />
                  <button onClick={handleCreateFolder} disabled={!newFolderName.trim() || creatingFolder}
                    className="text-xs btn-brand px-3 py-1.5 rounded-lg disabled:opacity-50">Create</button>
                  <button onClick={() => { setShowNewFolder(false); setNewFolderName('') }} className="text-xs text-slate-500 hover:text-white">Cancel</button>
                </div>
              ) : (
                <>
                  <button onClick={() => setShowNewFolder(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-white/[0.08] text-slate-400 hover:text-white rounded-lg">
                    <FolderPlus className="h-3.5 w-3.5" /> New Folder
                  </button>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 btn-brand font-medium rounded-lg">
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleFileUpload(e.target.files)} />
                </>
              )}
            </div>
          </div>

          {driveLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[0,1,2,3].map(i => <div key={i} className="h-24 skeleton rounded-xl" />)}</div>
          ) : (driveFolders.length === 0 && driveFiles.length === 0) ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files) }}
              className={`border-2 border-dashed rounded-xl p-16 text-center transition-colors ${dragOver ? 'border-sky-500 bg-sky-500/10' : 'border-white/[0.10]'}`}>
              <Folder className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">This folder is empty</p>
              <p className="text-slate-500 text-sm mt-1">Drag files here or click Upload above</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {driveFolders.map(f => (
                <button key={f.id} onClick={() => navigateFolder(f.id, f.name)}
                  className="glass-card p-4 flex flex-col items-center gap-2 hover:bg-white/[0.04] transition-colors">
                  <Folder className="h-8 w-8 text-amber-400" />
                  <p className="text-xs font-medium text-slate-300 text-center line-clamp-2">{f.name}</p>
                </button>
              ))}
              {driveFiles.map(f => (
                <a key={f.id} href={f.webViewLink} target="_blank" rel="noopener noreferrer"
                  className="glass-card p-4 flex flex-col items-center gap-2 hover:bg-white/[0.04] transition-colors">
                  <FileText className="h-8 w-8 text-slate-400" />
                  <p className="text-xs font-medium text-slate-300 text-center line-clamp-2">{f.name}</p>
                  <p className="text-[10px] text-slate-600">{f.mimeType?.split('/').pop()?.split('.').pop() || 'file'}</p>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── INTEGRATIONS ── */}
      {activeTab === 6 && (
        <div className="max-w-2xl space-y-6">
          {/* Google Ads */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl">🔵</span>
              <div>
                <h2 className="font-semibold text-white">Google Ads</h2>
                <p className="text-xs text-slate-400">Map a Google Ads customer account to sync campaign data</p>
              </div>
              {savedGoogleAccount && <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400"><CheckCircle className="h-3 w-3" /> Mapped</span>}
            </div>
            {googleAdsError === 'not_connected' ? (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-300">
                Google Ads is not connected. <a href="/settings/integrations" className="underline hover:text-amber-200">Connect in Settings → Integrations</a>
              </div>
            ) : googleAdsLoading ? <div className="h-10 skeleton rounded-lg" /> : googleAdsError ? (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{googleAdsError}</div>
            ) : (
              <div className="space-y-3">
                {savedGoogleAccount && <div className="text-xs text-slate-400">Current: <span className="text-slate-300 font-medium">{savedGoogleAccount.ad_account_name || savedGoogleAccount.ad_account_id}</span></div>}
                <div className="flex gap-2">
                  <select value={selectedGoogleAccount} onChange={e => setSelectedGoogleAccount(e.target.value)} className={sel}>
                    <option value="">Select customer account…</option>
                    {googleAdsAccounts.map(a => <option key={a.customer_id} value={a.customer_id}>{a.name || a.descriptive_name || a.customer_id} ({a.customer_id})</option>)}
                  </select>
                  <button disabled={!selectedGoogleAccount || savingGoogle} onClick={async () => {
                    setSavingGoogle(true)
                    const account = googleAdsAccounts.find(a => a.customer_id === selectedGoogleAccount)
                    const res = await fetch(`/api/clients/${params.id}/integrations`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'google_ads', ad_account_id: selectedGoogleAccount, ad_account_name: account?.name || account?.descriptive_name }) })
                    if (res.ok) { setSavedGoogleAccount(await res.json()); setSelectedGoogleAccount('') }
                    setSavingGoogle(false)
                  }} className="btn-brand px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 whitespace-nowrap">{savingGoogle ? 'Saving…' : 'Save'}</button>
                </div>
                {savedGoogleAccount && (
                  <button disabled={syncingGoogle} onClick={async () => {
                    setSyncingGoogle(true); setGoogleSyncDone(false)
                    const now2 = new Date(); const y = now2.getFullYear(); const m = now2.getMonth() + 1
                    const period_start = `${y}-${String(m).padStart(2, '0')}-01`
                    const period_end = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`
                    await fetch('/api/integrations/google-ads/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: params.id, customer_id: savedGoogleAccount.ad_account_id, period_start, period_end }) })
                    setSyncingGoogle(false); setGoogleSyncDone(true); setTimeout(() => setGoogleSyncDone(false), 3000)
                  }} className="flex items-center gap-2 px-3 py-1.5 text-sm border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-50">
                    <RefreshCw className={`h-3.5 w-3.5 ${syncingGoogle ? 'animate-spin' : ''}`} />
                    {syncingGoogle ? 'Syncing…' : googleSyncDone ? 'Synced!' : 'Sync Now'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* QuickBooks */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-sm">QB</div>
              <div>
                <h2 className="font-semibold text-white">QuickBooks Customer</h2>
                <p className="text-xs text-slate-400">Link a QuickBooks customer to sync billing data</p>
              </div>
              {savedQbCustomer && <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400"><CheckCircle className="h-3 w-3" /> Mapped</span>}
            </div>
            {qbCustomersError === 'not_connected' ? (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-300">
                QuickBooks is not connected. <a href="/settings/integrations" className="underline hover:text-amber-200">Connect in Settings → Integrations</a>
              </div>
            ) : qbCustomersLoading ? <div className="h-10 skeleton rounded-lg" /> : qbCustomersError ? (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{qbCustomersError}</div>
            ) : (
              <div className="space-y-3">
                {savedQbCustomer && <div className="text-xs text-slate-400">Current: <span className="text-slate-300 font-medium">{savedQbCustomer.ad_account_name || savedQbCustomer.ad_account_id}</span></div>}
                <div className="flex gap-2">
                  <select value={selectedQbCustomer} onChange={e => setSelectedQbCustomer(e.target.value)} className={sel}>
                    <option value="">Select QB customer…</option>
                    {qbCustomers.map(c => <option key={c.id} value={c.id}>{c.name}{c.email ? ` (${c.email})` : ''}</option>)}
                  </select>
                  <button disabled={!selectedQbCustomer || savingQb} onClick={async () => {
                    setSavingQb(true)
                    const customer = qbCustomers.find(c => c.id === selectedQbCustomer)
                    const res = await fetch(`/api/clients/${params.id}/integrations`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'quickbooks', account_id: customer?.name, external_id: selectedQbCustomer }) })
                    if (res.ok) { setSavedQbCustomer(await res.json()); setSelectedQbCustomer('') }
                    setSavingQb(false)
                  }} className="btn-brand px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 whitespace-nowrap">{savingQb ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            )}
          </div>

          {/* Meta Ads */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl">🔷</span>
              <div>
                <h2 className="font-semibold text-white">Meta Ads</h2>
                <p className="text-xs text-slate-400">Connect a Meta ad account to sync campaign data</p>
              </div>
              {savedMetaAccount && <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400"><CheckCircle className="h-3 w-3" /> Mapped</span>}
            </div>
            {metaAccountsError === 'not_connected' ? (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-300">
                Meta Ads is not connected. <a href="/settings/integrations" className="underline hover:text-amber-200">Connect in Settings → Integrations</a>
              </div>
            ) : metaAccountsLoading ? <div className="h-10 skeleton rounded-lg" /> : metaAccountsError ? (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{metaAccountsError}</div>
            ) : (
              <div className="space-y-3">
                {savedMetaAccount && <div className="text-xs text-slate-400">Current: <span className="text-slate-300 font-medium">{savedMetaAccount.ad_account_name || savedMetaAccount.ad_account_id}</span></div>}
                <div className="flex gap-2">
                  <select value={selectedMetaAccount} onChange={e => setSelectedMetaAccount(e.target.value)} className={sel}>
                    <option value="">Select ad account…</option>
                    {metaAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
                  </select>
                  <button disabled={!selectedMetaAccount || savingMeta} onClick={async () => {
                    setSavingMeta(true)
                    const account = metaAccounts.find(a => a.id === selectedMetaAccount)
                    const res = await fetch(`/api/clients/${params.id}/integrations`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'meta_ads', ad_account_id: selectedMetaAccount, ad_account_name: account?.name }) })
                    if (res.ok) { setSavedMetaAccount(await res.json()); setSelectedMetaAccount('') }
                    setSavingMeta(false)
                  }} className="btn-brand px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 whitespace-nowrap">{savingMeta ? 'Saving…' : 'Save'}</button>
                </div>
                {savedMetaAccount && (
                  <button disabled={syncingMeta} onClick={async () => {
                    setSyncingMeta(true); setMetaSyncDone(false)
                    const now2 = new Date(); const y = now2.getFullYear(); const m = now2.getMonth() + 1
                    const period_start = `${y}-${String(m).padStart(2, '0')}-01`
                    const period_end = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`
                    await fetch('/api/integrations/meta-ads/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: params.id, ad_account_id: savedMetaAccount.ad_account_id, period_start, period_end }) })
                    setSyncingMeta(false); setMetaSyncDone(true); setTimeout(() => setMetaSyncDone(false), 3000)
                  }} className="flex items-center gap-2 px-3 py-1.5 text-sm border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-50">
                    <RefreshCw className={`h-3.5 w-3.5 ${syncingMeta ? 'animate-spin' : ''}`} />
                    {syncingMeta ? 'Syncing…' : metaSyncDone ? 'Synced!' : 'Sync Now'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
