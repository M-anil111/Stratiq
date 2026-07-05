'use client'
import { useState, useEffect, useRef } from 'react'
import { Edit2, UserX, Shield, Loader2, X, Check, Mail, Upload, Copy, Send, Trash2, Users, FolderKey, Briefcase, UserCircle } from 'lucide-react'
import AddButton from '@/components/ui/AddButton'

const tabs = ['Employees', 'Invitations', 'Roles & Permissions', 'Client Accounts']

const ROLES: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-purple-500/20 text-purple-300' },
  admin: { label: 'Admin', color: 'bg-blue-500/20 text-blue-300' },
  manager: { label: 'Manager', color: 'bg-sky-500/20 text-sky-300' },
  team_member: { label: 'Team Member', color: 'bg-white/[0.08] text-slate-300' },
  billing_admin: { label: 'Billing Admin', color: 'bg-amber-500/20 text-amber-300' },
  client: { label: 'Client', color: 'bg-green-500/20 text-green-300' },
}

const ROLE_DESCRIPTIONS = [
  {
    role: 'admin',
    label: 'Admin',
    color: 'bg-blue-500/20 text-blue-300',
    description: 'Full access to all features. Can manage team members, billing, and organization settings.',
    permissions: ['All modules (view, create, edit, delete)', 'Invite & remove team members', 'Change member roles', 'Manage billing & settings'],
  },
  {
    role: 'manager',
    label: 'Manager',
    color: 'bg-sky-500/20 text-sky-300',
    description: 'Can manage clients, projects, and reports. Cannot manage team or billing.',
    permissions: ['Clients (view, create, edit)', 'Projects (view, create, edit, delete)', 'Reports (view, create)', 'Messages (view, send)', 'Cannot manage team or billing'],
  },
  {
    role: 'team_member',
    label: 'Team Member',
    color: 'bg-white/[0.08] text-slate-300',
    description: 'Standard staff access. Can view and work with assigned clients and projects.',
    permissions: ['Clients (view)', 'Projects (view, edit own)', 'Activity records (create, edit own)', 'Messages (view, send)', 'Reports (view)'],
  },
  {
    role: 'billing_admin',
    label: 'Billing Admin',
    color: 'bg-amber-500/20 text-amber-300',
    description: 'Access to billing and financial reporting only.',
    permissions: ['Billing & invoices (full access)', 'Financial reports (view)', 'Cannot access client or project data'],
  },
  {
    role: 'client',
    label: 'Client',
    color: 'bg-green-500/20 text-green-300',
    description: 'Portal-only access. Can view their own reports and communicate with the team.',
    permissions: ['Own reports (view)', 'Messages (view, send)', 'Own project status (view)', 'No access to internal data'],
  },
]

const STAFF_ROLE_OPTIONS = [
  { value: 'team_member', label: 'Team Member' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
  { value: 'billing_admin', label: 'Billing Admin' },
]

const VALID_ROLES = ['team_member', 'manager', 'admin', 'billing_admin', 'client']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CSV_CAP = 100

type Chip = { email: string; valid: boolean }
type CsvRow = { email: string; role: string; selected: boolean; valid: boolean }
type Invite = { id: string; email: string; role: string; token: string; created_at: string; expires_at: string | null }
type ProjectOption = { id: string; label: string; sublabel?: string }
type SendResult = {
  sent: { email: string }[]
  skipped: { email: string; reason?: string }[]
  errors: { email: string; reason?: string }[]
}

function normalizeCsvRole(raw: string): string {
  const r = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return VALID_ROLES.includes(r) ? r : ''
}

function parseCsvText(text: string): { rows: CsvRow[]; error: string } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return { rows: [], error: 'The file is empty' }

  const splitLine = (line: string) => line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))

  const headerCells = splitLine(lines[0])
  let emailIdx = headerCells.findIndex(c => /^e-?mail/i.test(c))
  let roleIdx = headerCells.findIndex(c => /^role$/i.test(c))
  let dataLines = lines
  if (emailIdx >= 0) {
    dataLines = lines.slice(1)
  } else {
    emailIdx = 0
    roleIdx = -1
  }

  const seen = new Set<string>()
  const rows: CsvRow[] = []
  for (const line of dataLines) {
    if (rows.length >= CSV_CAP) break
    const cells = splitLine(line)
    const email = (cells[emailIdx] || '').toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    const valid = EMAIL_RE.test(email)
    rows.push({
      email,
      role: roleIdx >= 0 ? normalizeCsvRole(cells[roleIdx] || '') : '',
      selected: valid,
      valid,
    })
  }
  if (rows.length === 0) return { rows: [], error: 'No email addresses found in the file' }
  const capped = dataLines.length > CSV_CAP
  return { rows, error: capped ? `Only the first ${CSV_CAP} rows were imported` : '' }
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Add users modal (HubSpot-style)
  const [showAdd, setShowAdd] = useState(false)
  const [clientMode, setClientMode] = useState(false)
  const [chips, setChips] = useState<Chip[]>([])
  const [emailInput, setEmailInput] = useState('')
  const [addRole, setAddRole] = useState('team_member')
  const [sending, setSending] = useState(false)
  const [addError, setAddError] = useState('')
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null)
  const [csvNote, setCsvNote] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // SE Ranking-style account type + project access scope (add-users modal)
  const [accountType, setAccountType] = useState<'user' | 'client'>('user')
  const [projectAccess, setProjectAccess] = useState<'all' | 'specific'>('all')
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])

  // Projects list for the multi-select (shared by add + manage-access modals)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectsLoaded, setProjectsLoaded] = useState(false)
  const [projectsLoading, setProjectsLoading] = useState(false)

  // Manage project access modal (per existing member)
  const [accessMember, setAccessMember] = useState<any>(null)
  const [accessScope, setAccessScope] = useState<'all' | 'specific'>('all')
  const [accessProjectIds, setAccessProjectIds] = useState<string[]>([])
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessSaving, setAccessSaving] = useState(false)
  const [accessError, setAccessError] = useState('')

  // Pending invites
  const [invites, setInvites] = useState<Invite[]>([])
  const [invitesLoading, setInvitesLoading] = useState(true)
  const [invitesAllowed, setInvitesAllowed] = useState(true)
  const [inviteActionId, setInviteActionId] = useState('')
  const [copiedId, setCopiedId] = useState('')
  const [inviteActionError, setInviteActionError] = useState('')

  // Edit role modal
  const [editingMember, setEditingMember] = useState<any>(null)
  const [editRole, setEditRole] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Remove confirmation
  const [removingMember, setRemovingMember] = useState<any>(null)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [removeError, setRemoveError] = useState('')

  // Assign role template (member picker)
  const [assignRoleKey, setAssignRoleKey] = useState<string | null>(null)
  const [assignMemberId, setAssignMemberId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/team')
      .then(res => res.json())
      .then(data => setMembers(Array.isArray(data) ? data : []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false))
    loadInvites()
  }, [])

  function loadInvites() {
    setInvitesLoading(true)
    fetch('/api/team/invites')
      .then(async res => {
        if (res.status === 403) { setInvitesAllowed(false); return [] }
        return res.json()
      })
      .then(data => setInvites(Array.isArray(data) ? data : []))
      .catch(() => setInvites([]))
      .finally(() => setInvitesLoading(false))
  }

  // Load projects for the multi-select. Prefer /api/projects; degrade to
  // deriving projects from /api/clients when that endpoint is unavailable.
  async function loadProjects() {
    if (projectsLoaded || projectsLoading) return
    setProjectsLoading(true)
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const d = await res.json()
        const list: ProjectOption[] = (Array.isArray(d?.projects) ? d.projects : []).map((p: any) => ({
          id: p.id,
          label: p.name || p.domain || p.client?.company_name || 'Untitled project',
          sublabel: p.client?.company_name || p.domain || '',
        }))
        setProjects(list)
        setProjectsLoaded(true)
        setProjectsLoading(false)
        return
      }
    } catch {
      // fall through to clients-derived projects
    }
    try {
      const res = await fetch('/api/clients?limit=100')
      const d = await res.json()
      const clientsArr = Array.isArray(d) ? d : (Array.isArray(d?.clients) ? d.clients : [])
      const list: ProjectOption[] = []
      for (const c of clientsArr) {
        for (const p of (c.projects || [])) {
          list.push({ id: p.id, label: p.name || c.company_name || 'Project', sublabel: c.company_name || '' })
        }
      }
      setProjects(list)
    } catch {
      setProjects([])
    } finally {
      setProjectsLoaded(true)
      setProjectsLoading(false)
    }
  }

  const filtered = members.filter(m =>
    !search || m.full_name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase())
  )

  const clients = members.filter(m => m.role === 'client')
  const staffMembers = members.filter(m => m.role !== 'client')

  // ---- Edit / remove (unchanged behavior) ----
  function openEdit(member: any) {
    setEditingMember(member)
    setEditRole(member.role)
    setEditError('')
  }

  function closeEdit() {
    setEditingMember(null)
    setEditError('')
  }

  async function handleEditSave() {
    if (!editingMember) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/team/${editingMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editRole }),
      })
      const d = await res.json()
      if (!res.ok) { setEditError(d.error || 'Failed to update role'); return }
      setMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, role: editRole } : m))
      closeEdit()
    } catch {
      setEditError('Network error. Please try again.')
    } finally {
      setEditSaving(false)
    }
  }

  function openRemove(member: any) {
    setRemovingMember(member)
    setRemoveError('')
  }

  function closeRemove() {
    setRemovingMember(null)
    setRemoveError('')
  }

  async function handleRemove() {
    if (!removingMember) return
    setRemoveLoading(true)
    setRemoveError('')
    try {
      const res = await fetch(`/api/team/${removingMember.id}`, { method: 'DELETE' })
      const d = await res.json()
      if (!res.ok) { setRemoveError(d.error || 'Failed to remove member'); return }
      setMembers(prev => prev.filter(m => m.id !== removingMember.id))
      closeRemove()
    } catch {
      setRemoveError('Network error. Please try again.')
    } finally {
      setRemoveLoading(false)
    }
  }

  // ---- Add users modal ----
  function openAdd(asClient = false) {
    setClientMode(asClient)
    setChips([])
    setEmailInput('')
    setAccountType(asClient ? 'client' : 'user')
    setAddRole(asClient ? 'client' : 'team_member')
    setProjectAccess('all')
    setSelectedProjectIds([])
    setAddError('')
    setSendResult(null)
    setCsvRows(null)
    setCsvNote('')
    setShowAdd(true)
    loadProjects()
  }

  // Account type toggle keeps role in sync with the SE Ranking-style choice.
  function chooseAccountType(type: 'user' | 'client') {
    setAccountType(type)
    if (type === 'client') setAddRole('client')
    else if (addRole === 'client') setAddRole('team_member')
  }

  function toggleSelectedProject(id: string) {
    setSelectedProjectIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  function closeAdd() {
    setShowAdd(false)
    setSendResult(null)
    setCsvRows(null)
  }

  function addEmailTokens(text: string) {
    const parts = text.split(/[\s,;]+/).map(p => p.trim().toLowerCase()).filter(Boolean)
    if (parts.length === 0) return
    setChips(prev => {
      const existing = new Set(prev.map(c => c.email))
      const next = [...prev]
      for (const p of parts) {
        if (existing.has(p)) continue
        existing.add(p)
        next.push({ email: p, valid: EMAIL_RE.test(p) })
      }
      return next
    })
  }

  function handleEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (emailInput.trim()) {
        e.preventDefault()
        addEmailTokens(emailInput)
        setEmailInput('')
      }
    } else if (e.key === 'Backspace' && !emailInput && chips.length > 0) {
      setChips(prev => prev.slice(0, -1))
    }
  }

  function handleEmailPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text')
    if (/[\s,;]/.test(text)) {
      e.preventDefault()
      addEmailTokens(text)
      setEmailInput('')
    }
  }

  function handleEmailBlur() {
    if (emailInput.trim()) {
      addEmailTokens(emailInput)
      setEmailInput('')
    }
  }

  function removeChip(email: string) {
    setChips(prev => prev.filter(c => c.email !== email))
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const { rows, error } = parseCsvText(String(reader.result || ''))
      if (rows.length === 0) {
        setAddError(error || 'Could not parse the CSV file')
        return
      }
      setAddError('')
      setCsvNote(error)
      setCsvRows(rows)
      setSendResult(null)
    }
    reader.onerror = () => setAddError('Failed to read the file')
    reader.readAsText(file)
  }

  function toggleCsvRow(email: string) {
    setCsvRows(prev => prev && prev.map(r => r.email === email ? { ...r, selected: r.valid && !r.selected } : r))
  }

  function toggleCsvAll(selected: boolean) {
    setCsvRows(prev => prev && prev.map(r => ({ ...r, selected: r.valid && selected })))
  }

  const validChips = chips.filter(c => c.valid)
  const invalidChipCount = chips.length - validChips.length
  const csvSelectedCount = csvRows ? csvRows.filter(r => r.selected).length : 0
  const sendCount = csvRows ? csvSelectedCount : validChips.length
  const summaryRole = ROLE_DESCRIPTIONS.find(r => r.role === addRole)

  async function handleSendInvites() {
    setAddError('')
    setSending(true)
    try {
      // Group emails by role: CSV rows may carry their own Role column, chips use the dropdown
      const byRole = new Map<string, string[]>()
      if (csvRows) {
        for (const r of csvRows) {
          if (!r.selected) continue
          const role = r.role || addRole
          byRole.set(role, [...(byRole.get(role) || []), r.email])
        }
      } else {
        byRole.set(addRole, validChips.map(c => c.email))
      }
      if (Array.from(byRole.values()).every(a => a.length === 0)) {
        setAddError('Add at least one valid email address')
        return
      }

      const merged: SendResult = { sent: [], skipped: [], errors: [] }
      for (const [role, emails] of Array.from(byRole.entries())) {
        if (emails.length === 0) continue
        const res = await fetch('/api/team/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emails,
            role,
            account_type: accountType,
            project_access: projectAccess,
            project_ids: projectAccess === 'specific' ? selectedProjectIds : [],
          }),
        })
        const d = await res.json()
        if (!res.ok) {
          merged.errors.push(...emails.map(email => ({ email, reason: d.error || 'Request failed' })))
          continue
        }
        merged.sent.push(...(d.sent || []))
        merged.skipped.push(...(d.skipped || []))
        merged.errors.push(...(d.errors || []))
      }
      setSendResult(merged)
      setChips([])
      setEmailInput('')
      setCsvRows(null)
      loadInvites()
    } catch {
      setAddError('Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  // ---- Invite actions ----
  async function handleResendInvite(inv: Invite) {
    setInviteActionId(inv.id)
    setInviteActionError('')
    try {
      const res = await fetch('/api/team/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inv.id }),
      })
      const d = await res.json()
      if (!res.ok) { setInviteActionError(d.error || 'Failed to resend invite'); return }
      setInvites(prev => prev.map(i => i.id === inv.id ? { ...i, expires_at: d.expires_at || i.expires_at } : i))
    } catch {
      setInviteActionError('Network error. Please try again.')
    } finally {
      setInviteActionId('')
    }
  }

  async function handleRevokeInvite(inv: Invite) {
    setInviteActionId(inv.id)
    setInviteActionError('')
    try {
      const res = await fetch(`/api/team/invites?id=${encodeURIComponent(inv.id)}`, { method: 'DELETE' })
      const d = await res.json()
      if (!res.ok) { setInviteActionError(d.error || 'Failed to revoke invite'); return }
      setInvites(prev => prev.filter(i => i.id !== inv.id))
    } catch {
      setInviteActionError('Network error. Please try again.')
    } finally {
      setInviteActionId('')
    }
  }

  async function handleCopyLink(inv: Invite) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/login?invite=${inv.token}`)
      setCopiedId(inv.id)
      setTimeout(() => setCopiedId(''), 2000)
    } catch {
      setInviteActionError('Failed to copy link to clipboard')
    }
  }

  // ---- Assign role template ----
  function openAssign(role: string) {
    setAssignRoleKey(role)
    setAssignMemberId('')
    setAssignError('')
  }

  function closeAssign() {
    setAssignRoleKey(null)
    setAssignError('')
  }

  async function handleAssign() {
    if (!assignRoleKey || !assignMemberId) return
    setAssigning(true)
    setAssignError('')
    try {
      const res = await fetch(`/api/team/${assignMemberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: assignRoleKey }),
      })
      const d = await res.json()
      if (!res.ok) { setAssignError(d.error || 'Failed to assign role'); return }
      setMembers(prev => prev.map(m => m.id === assignMemberId ? { ...m, role: assignRoleKey } : m))
      closeAssign()
    } catch {
      setAssignError('Network error. Please try again.')
    } finally {
      setAssigning(false)
    }
  }

  const assignTemplate = ROLE_DESCRIPTIONS.find(r => r.role === assignRoleKey)
  const assignCandidates = assignRoleKey === 'client' ? members : staffMembers

  // ---- Manage project access (per member) ----
  async function openAccess(member: any) {
    setAccessMember(member)
    setAccessError('')
    setAccessScope('all')
    setAccessProjectIds([])
    setAccessLoading(true)
    loadProjects()
    try {
      const res = await fetch(`/api/team/${member.id}/access`)
      const d = await res.json()
      if (res.ok) {
        setAccessScope(d.project_access === 'specific' ? 'specific' : 'all')
        setAccessProjectIds(Array.isArray(d.project_ids) ? d.project_ids : [])
      } else {
        setAccessError(d.error || 'Failed to load access settings')
      }
    } catch {
      setAccessError('Network error. Please try again.')
    } finally {
      setAccessLoading(false)
    }
  }

  function closeAccess() {
    setAccessMember(null)
    setAccessError('')
  }

  function toggleAccessProject(id: string) {
    setAccessProjectIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  async function handleAccessSave() {
    if (!accessMember) return
    setAccessSaving(true)
    setAccessError('')
    try {
      const res = await fetch(`/api/team/${accessMember.id}/access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_access: accessScope,
          project_ids: accessScope === 'specific' ? accessProjectIds : [],
        }),
      })
      const d = await res.json()
      if (!res.ok) { setAccessError(d.error || 'Failed to update access'); return }
      setMembers(prev => prev.map(m => m.id === accessMember.id ? { ...m, project_access: d.project_access } : m))
      closeAccess()
    } catch {
      setAccessError('Network error. Please try again.')
    } finally {
      setAccessSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-slate-400 text-sm">Manage users, roles, and permissions</p>
        </div>
        <AddButton label="Add Users" onClick={() => openAdd(false)} />
      </div>

      <div className="flex border-b border-white/[0.08] mb-6 overflow-x-auto">
        {tabs.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === i ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
            {tab}
            {tab === 'Invitations' && invites.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/20 text-sky-300">{invites.length}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 0 && (
        <div className="glass-card">
          <div className="p-4 border-b border-white/[0.08]">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search team members..."
              className="input-glass sm:w-72"
            />
          </div>
          <div className="divide-y divide-white/[0.06]">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full skeleton" />
                    <div>
                      <div className="h-4 skeleton rounded w-32 mb-1" />
                      <div className="h-3 skeleton rounded w-48" />
                    </div>
                  </div>
                  <div className="h-5 skeleton rounded w-20" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">
                {search ? 'No members match your search' : 'No team members yet'}
              </div>
            ) : (
              filtered.map(user => (
                <div key={user.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/[0.08] text-slate-300 flex items-center justify-center font-semibold text-sm">
                        {(user.full_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-white text-sm">{user.full_name}</p>
                      <p className="text-xs text-slate-400">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLES[user.role]?.color || 'bg-white/[0.08] text-slate-300'}`}>
                      {ROLES[user.role]?.label || user.role}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => openAccess(user)} title="Manage project access" className="p-1.5 text-slate-400 hover:text-sky-400 rounded-lg hover:bg-white/[0.06]"><FolderKey className="h-4 w-4" /></button>
                      <button onClick={() => openEdit(user)} className="p-1.5 text-slate-400 hover:text-sky-400 rounded-lg hover:bg-white/[0.06]"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => openRemove(user)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/[0.06]"><UserX className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 1 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-400 text-sm">
              {invites.length} pending invitation{invites.length !== 1 ? 's' : ''}
            </p>
            <AddButton label="Add Users" onClick={() => openAdd(false)} />
          </div>
          {inviteActionError && <p className="text-sm text-red-400 mb-3">{inviteActionError}</p>}
          <div className="glass-card">
            {!invitesAllowed ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">
                Only admins can view pending invitations
              </div>
            ) : invitesLoading ? (
              <div className="divide-y divide-white/[0.06]">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="h-4 skeleton rounded w-48 mb-1" />
                      <div className="h-3 skeleton rounded w-32" />
                    </div>
                    <div className="h-5 skeleton rounded w-24" />
                  </div>
                ))}
              </div>
            ) : invites.length === 0 ? (
              <div className="px-4 py-10 text-center text-slate-400 text-sm">
                <Mail className="h-8 w-8 mx-auto mb-3 text-slate-500" />
                <p className="font-medium">No pending invitations</p>
                <p className="mt-1">Invites you send will appear here until they&apos;re accepted</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {invites.map(inv => (
                  <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-sky-500/10 text-sky-300 flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white text-sm truncate">{inv.email}</p>
                        <p className="text-xs text-slate-400">
                          Invited {formatDate(inv.created_at)} &middot; Expires {formatDate(inv.expires_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLES[inv.role]?.color || 'bg-white/[0.08] text-slate-300'}`}>
                        {ROLES[inv.role]?.label || inv.role}
                      </span>
                      <button
                        onClick={() => handleResendInvite(inv)}
                        disabled={inviteActionId === inv.id}
                        title="Resend invite"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-sky-300 hover:bg-white/[0.06] disabled:opacity-50"
                      >
                        {inviteActionId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Resend
                      </button>
                      <button
                        onClick={() => handleCopyLink(inv)}
                        title="Copy invite link"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-sky-300 hover:bg-white/[0.06]"
                      >
                        {copiedId === inv.id ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedId === inv.id ? 'Copied' : 'Copy link'}
                      </button>
                      <button
                        onClick={() => handleRevokeInvite(inv)}
                        disabled={inviteActionId === inv.id}
                        title="Revoke invite"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-red-400 hover:bg-white/[0.06] disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 2 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-sky-400" />
            <h2 className="font-semibold text-white">Roles &amp; Permissions</h2>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Start with a template. Each role bundles a set of permissions — assign one to a team member to apply it.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROLE_DESCRIPTIONS.map(r => (
              <div key={r.role} className="glass-card p-5 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${r.color}`}>{r.label}</span>
                  <span className="text-xs text-slate-500">
                    {members.filter(m => m.role === r.role).length} member{members.filter(m => m.role === r.role).length !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mb-3">{r.description}</p>
                <ul className="space-y-1 flex-1">
                  {r.permissions.map(p => (
                    <li key={p} className="flex items-start gap-2 text-xs text-slate-400">
                      <Check className="h-3.5 w-3.5 text-sky-400 mt-0.5 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-3 border-t border-white/[0.08]">
                  <button
                    onClick={() => openAssign(r.role)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-white/[0.12] text-sm font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <Users className="h-4 w-4" /> Assign to member
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 3 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-400 text-sm">{clients.length} client account{clients.length !== 1 ? 's' : ''}</p>
            <AddButton label="Invite Client" onClick={() => openAdd(true)} icon={<UserCircle className="h-4 w-4 shrink-0" />} />
          </div>
          <div className="glass-card">
            <div className="divide-y divide-white/[0.06]">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full skeleton" />
                      <div>
                        <div className="h-4 skeleton rounded w-32 mb-1" />
                        <div className="h-3 skeleton rounded w-48" />
                      </div>
                    </div>
                    <div className="h-5 skeleton rounded w-16" />
                  </div>
                ))
              ) : clients.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-400 text-sm">
                  <p className="font-medium">No client portal accounts yet</p>
                  <p className="mt-1">Invite clients to grant them portal access</p>
                </div>
              ) : (
                clients.map(user => (
                  <div key={user.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-green-500/20 text-green-300 flex items-center justify-center font-semibold text-sm">
                          {(user.full_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-white text-sm">{user.full_name}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-300">Client</span>
                      <div className="flex gap-1">
                        <button onClick={() => openAccess(user)} title="Manage project access" className="p-1.5 text-slate-400 hover:text-sky-400 rounded-lg hover:bg-white/[0.06]"><FolderKey className="h-4 w-4" /></button>
                        <button onClick={() => openRemove(user)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/[0.06]"><UserX className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Edit Role</h2>
              <button onClick={closeEdit} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06]"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-slate-400 mb-4">{editingMember.full_name} &mdash; {editingMember.email}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
              <select
                value={editRole}
                onChange={e => setEditRole(e.target.value)}
                className="input-glass"
              >
                {STAFF_ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {editError && <p className="text-sm text-red-400 mb-3">{editError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={closeEdit} className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.12] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors text-sm font-medium">Cancel</button>
              <button onClick={handleEditSave} disabled={editSaving} className="btn-brand flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
                {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Remove Member</h2>
              <button onClick={closeRemove} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06]"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Are you sure you want to remove <span className="text-white font-medium">{removingMember.full_name}</span> from your team? This action cannot be undone.
            </p>
            {removeError && <p className="text-sm text-red-400 mb-3">{removeError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={closeRemove} className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.12] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors text-sm font-medium">Cancel</button>
              <button onClick={handleRemove} disabled={removeLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-colors text-sm font-medium disabled:opacity-60">
                {removeLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {removeLoading ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Users Modal (HubSpot-style) */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">{clientMode ? 'Invite Clients' : 'Add Users'}</h2>
              <button onClick={closeAdd} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {sendResult ? (
              <div>
                <div className="space-y-3 mb-5">
                  {sendResult.sent.length > 0 && (
                    <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3">
                      <p className="text-sm font-medium text-green-300 mb-1">
                        {sendResult.sent.length} invite{sendResult.sent.length !== 1 ? 's' : ''} sent
                      </p>
                      <p className="text-xs text-slate-400 break-words">{sendResult.sent.map(s => s.email).join(', ')}</p>
                    </div>
                  )}
                  {sendResult.skipped.length > 0 && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
                      <p className="text-sm font-medium text-amber-300 mb-1">
                        {sendResult.skipped.length} skipped
                      </p>
                      <ul className="text-xs text-slate-400 space-y-0.5">
                        {sendResult.skipped.map(s => <li key={s.email}>{s.email}{s.reason ? ` — ${s.reason}` : ''}</li>)}
                      </ul>
                    </div>
                  )}
                  {sendResult.errors.length > 0 && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                      <p className="text-sm font-medium text-red-300 mb-1">
                        {sendResult.errors.length} failed
                      </p>
                      <ul className="text-xs text-slate-400 space-y-0.5">
                        {sendResult.errors.map(s => <li key={s.email}>{s.email}{s.reason ? ` — ${s.reason}` : ''}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setSendResult(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.12] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors text-sm font-medium">
                    Add more
                  </button>
                  <button onClick={closeAdd} className="btn-brand flex-1">Done</button>
                </div>
              </div>
            ) : csvRows ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-300">
                    <span className="font-medium text-white">{csvSelectedCount}</span> of {csvRows.length} rows selected
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => toggleCsvAll(true)} className="text-xs text-sky-400 hover:text-sky-300">Select all</button>
                    <button onClick={() => toggleCsvAll(false)} className="text-xs text-slate-400 hover:text-slate-300">Deselect all</button>
                  </div>
                </div>
                {csvNote && <p className="text-xs text-amber-300 mb-2">{csvNote}</p>}
                <div className="glass-card max-h-64 overflow-y-auto mb-4 divide-y divide-white/[0.06]">
                  {csvRows.map(row => (
                    <label key={row.email} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.03] ${!row.valid ? 'opacity-60' : ''}`}>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        disabled={!row.valid}
                        onChange={() => toggleCsvRow(row.email)}
                        className="accent-sky-500"
                      />
                      <span className={`text-sm flex-1 truncate ${row.valid ? 'text-white' : 'text-red-400 line-through'}`}>{row.email}</span>
                      <span className="text-xs text-slate-400">
                        {row.valid
                          ? (ROLES[row.role]?.label || ROLES[addRole]?.label || addRole)
                          : 'Invalid email'}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Rows without a valid Role column use the role selected below. Maximum {CSV_CAP} rows per import.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Default role</label>
                  <select value={addRole} onChange={e => setAddRole(e.target.value)} className="input-glass" disabled={clientMode}>
                    {clientMode
                      ? <option value="client">Client</option>
                      : STAFF_ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {addError && <p className="text-sm text-red-400 mb-3">{addError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setCsvRows(null); setCsvNote('') }} className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.12] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors text-sm font-medium">
                    Back
                  </button>
                  <button onClick={handleSendInvites} disabled={sending || csvSelectedCount === 0} className="btn-brand flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
                    {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {sending ? 'Sending…' : `Send ${csvSelectedCount} invite${csvSelectedCount !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Account type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => chooseAccountType('user')}
                      className={`text-left rounded-xl border p-3 transition-colors ${accountType === 'user' ? 'border-sky-500/60 bg-sky-500/10' : 'border-white/[0.12] hover:bg-white/[0.04]'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Briefcase className={`h-4 w-4 ${accountType === 'user' ? 'text-sky-400' : 'text-slate-400'}`} />
                        <span className="text-sm font-medium text-white">Team member / Manager</span>
                      </div>
                      <p className="text-xs text-slate-400">Internal staff. Managers can create &amp; edit; pick the seat below.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseAccountType('client')}
                      className={`text-left rounded-xl border p-3 transition-colors ${accountType === 'client' ? 'border-green-500/60 bg-green-500/10' : 'border-white/[0.12] hover:bg-white/[0.04]'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <UserCircle className={`h-4 w-4 ${accountType === 'client' ? 'text-green-400' : 'text-slate-400'}`} />
                        <span className="text-sm font-medium text-white">Client</span>
                      </div>
                      <p className="text-xs text-slate-400">Portal-only, view access to their assigned projects.</p>
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-300">Email addresses</label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium"
                    >
                      <Upload className="h-3.5 w-3.5" /> Import CSV
                    </button>
                    <input ref={fileInputRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={handleCsvFile} />
                  </div>
                  <div
                    className="input-glass min-h-[76px] flex flex-wrap items-start gap-1.5 cursor-text py-2"
                    onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}
                  >
                    {chips.map(chip => (
                      <span
                        key={chip.email}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${chip.valid ? 'bg-sky-500/20 text-sky-300' : 'bg-red-500/20 text-red-300'}`}
                      >
                        {chip.email}
                        <button type="button" onClick={() => removeChip(chip.email)} className="hover:text-white">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      onKeyDown={handleEmailKeyDown}
                      onPaste={handleEmailPaste}
                      onBlur={handleEmailBlur}
                      placeholder={chips.length === 0 ? 'jane@example.com, john@example.com…' : ''}
                      className="flex-1 min-w-[160px] bg-transparent outline-none text-sm text-white placeholder:text-slate-500 py-0.5"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Press Enter to add each address, or paste a list separated by commas or spaces.
                    {invalidChipCount > 0 && <span className="text-red-400"> {invalidChipCount} invalid address{invalidChipCount !== 1 ? 'es' : ''} won&apos;t be sent.</span>}
                  </p>
                </div>

                {accountType === 'user' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Role (seat)</label>
                    <select value={addRole} onChange={e => setAddRole(e.target.value)} className="input-glass">
                      {STAFF_ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Access to projects</label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="radio" name="add-project-access" checked={projectAccess === 'all'} onChange={() => setProjectAccess('all')} className="accent-sky-500 mt-0.5" />
                      <span>
                        <span className="block text-sm text-white">All projects</span>
                        <span className="block text-xs text-slate-400">Access to every project in the organization, including ones added later.</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="radio" name="add-project-access" checked={projectAccess === 'specific'} onChange={() => setProjectAccess('specific')} className="accent-sky-500 mt-0.5" />
                      <span>
                        <span className="block text-sm text-white">Specific projects</span>
                        <span className="block text-xs text-slate-400">Choose exactly which projects this {accountType === 'client' ? 'client' : 'user'} can access.</span>
                      </span>
                    </label>
                  </div>
                  {projectAccess === 'specific' && (
                    <div className="mt-3">
                      <ProjectMultiSelect
                        projects={projects}
                        loading={projectsLoading}
                        loaded={projectsLoaded}
                        selected={selectedProjectIds}
                        onToggle={toggleSelectedProject}
                      />
                    </div>
                  )}
                </div>

                {summaryRole && (
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-sky-400" />
                      <p className="text-sm font-medium text-white">What {summaryRole.label}s can do</p>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{summaryRole.description}</p>
                    <ul className="space-y-1">
                      {summaryRole.permissions.map(p => (
                        <li key={p} className="flex items-start gap-2 text-xs text-slate-400">
                          <Check className="h-3.5 w-3.5 text-sky-400 mt-0.5 shrink-0" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {addError && <p className="text-sm text-red-400 mb-3">{addError}</p>}

                <div className="flex gap-3">
                  <button type="button" onClick={closeAdd} className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.12] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors text-sm font-medium">
                    Cancel
                  </button>
                  <button
                    onClick={handleSendInvites}
                    disabled={sending || sendCount === 0}
                    className="btn-brand flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {sending ? 'Sending…' : sendCount > 0 ? `Send ${sendCount} invite${sendCount !== 1 ? 's' : ''}` : 'Send invites'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign Role Template Modal (member picker) */}
      {assignRoleKey && assignTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Assign {assignTemplate.label}</h2>
              <button onClick={closeAssign} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06]"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Choose a team member to apply the <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${assignTemplate.color}`}>{assignTemplate.label}</span> permission template.
            </p>
            <div className="glass-card max-h-64 overflow-y-auto divide-y divide-white/[0.06] mb-4">
              {assignCandidates.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-400 text-sm">No members available</div>
              ) : (
                assignCandidates.map(m => (
                  <label key={m.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.03]">
                    <input
                      type="radio"
                      name="assign-member"
                      checked={assignMemberId === m.id}
                      onChange={() => setAssignMemberId(m.id)}
                      className="accent-sky-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{m.full_name || m.email}</p>
                      <p className="text-xs text-slate-400 truncate">{m.email}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${ROLES[m.role]?.color || 'bg-white/[0.08] text-slate-300'}`}>
                      {ROLES[m.role]?.label || m.role}
                    </span>
                  </label>
                ))
              )}
            </div>
            {assignError && <p className="text-sm text-red-400 mb-3">{assignError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={closeAssign} className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.12] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors text-sm font-medium">Cancel</button>
              <button onClick={handleAssign} disabled={assigning || !assignMemberId} className="btn-brand flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
                {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
                {assigning ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Project Access Modal */}
      {accessMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2"><FolderKey className="h-5 w-5 text-sky-400" /> Manage project access</h2>
              <button onClick={closeAccess} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06]"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-slate-400 mb-4">{accessMember.full_name || accessMember.email} &mdash; {accessMember.email}</p>
            {accessLoading ? (
              <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <>
                <div className="space-y-2 mb-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="radio" name="manage-access" checked={accessScope === 'all'} onChange={() => setAccessScope('all')} className="accent-sky-500 mt-0.5" />
                    <span>
                      <span className="block text-sm text-white">All projects</span>
                      <span className="block text-xs text-slate-400">Access to every project, including ones added later.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="radio" name="manage-access" checked={accessScope === 'specific'} onChange={() => setAccessScope('specific')} className="accent-sky-500 mt-0.5" />
                    <span>
                      <span className="block text-sm text-white">Specific projects</span>
                      <span className="block text-xs text-slate-400">Only the projects selected below.</span>
                    </span>
                  </label>
                </div>
                {accessScope === 'specific' && (
                  <div className="mb-4">
                    <ProjectMultiSelect
                      projects={projects}
                      loading={projectsLoading}
                      loaded={projectsLoaded}
                      selected={accessProjectIds}
                      onToggle={toggleAccessProject}
                    />
                  </div>
                )}
                {accessError && <p className="text-sm text-red-400 mb-3">{accessError}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={closeAccess} className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.12] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors text-sm font-medium">Cancel</button>
                  <button onClick={handleAccessSave} disabled={accessSaving} className="btn-brand flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
                    {accessSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {accessSaving ? 'Saving…' : 'Save access'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectMultiSelect({
  projects,
  loading,
  loaded,
  selected,
  onToggle,
}: {
  projects: ProjectOption[]
  loading: boolean
  loaded: boolean
  selected: string[]
  onToggle: (id: string) => void
}) {
  const [filter, setFilter] = useState('')
  const list = filter
    ? projects.filter(p => p.label.toLowerCase().includes(filter.toLowerCase()) || (p.sublabel || '').toLowerCase().includes(filter.toLowerCase()))
    : projects

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search projects…"
          className="input-glass flex-1"
        />
        <span className="ml-3 text-xs text-slate-400 shrink-0">{selected.length} selected</span>
      </div>
      <div className="glass-card max-h-56 overflow-y-auto divide-y divide-white/[0.06]">
        {loading || !loaded ? (
          <div className="flex items-center justify-center py-6 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : list.length === 0 ? (
          <div className="px-4 py-6 text-center text-slate-400 text-sm">{projects.length === 0 ? 'No projects available' : 'No projects match your search'}</div>
        ) : (
          list.map(p => (
            <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.03]">
              <input type="checkbox" checked={selected.includes(p.id)} onChange={() => onToggle(p.id)} className="accent-sky-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{p.label}</p>
                {p.sublabel && <p className="text-xs text-slate-400 truncate">{p.sublabel}</p>}
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  )
}
