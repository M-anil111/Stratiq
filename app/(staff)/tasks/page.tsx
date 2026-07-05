'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Plus, X, Check, CheckSquare, Building2, CalendarDays, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Task = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  client: { id: string; company_name: string } | null
  assignee: { id: string; full_name: string } | null
}

type ClientOption = { id: string; company_name: string }
type TeamMember = { id: string; full_name: string }

type Tab = 'my' | 'all' | 'overdue' | 'completed'

const TABS: { key: Tab; label: string }[] = [
  { key: 'my', label: 'My Tasks' },
  { key: 'all', label: 'All' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
]

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-400',
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-400',
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isOverdue(task: Task) {
  return !!task.due_date && task.due_date < todayStr() && task.status !== 'done' && task.status !== 'cancelled'
}

function formatDue(dateStr: string) {
  const today = todayStr()
  if (dateStr === today) return 'Today'
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type Group = { key: string; label: string; headerClass: string; tasks: Task[] }

function groupTasks(tasks: Task[]): Group[] {
  const today = todayStr()
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`

  const groups: Group[] = [
    { key: 'overdue', label: 'Overdue', headerClass: 'text-red-400', tasks: [] },
    { key: 'today', label: 'Today', headerClass: 'text-sky-400', tasks: [] },
    { key: 'week', label: 'This Week', headerClass: 'text-slate-300', tasks: [] },
    { key: 'later', label: 'Later', headerClass: 'text-slate-400', tasks: [] },
    { key: 'none', label: 'No due date', headerClass: 'text-slate-500', tasks: [] },
  ]

  for (const task of tasks) {
    if (!task.due_date) groups[4].tasks.push(task)
    else if (isOverdue(task)) groups[0].tasks.push(task)
    else if (task.due_date === today) groups[1].tasks.push(task)
    else if (task.due_date <= weekEndStr) groups[2].tasks.push(task)
    else groups[3].tasks.push(task)
  }
  return groups.filter(g => g.tasks.length > 0)
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (task: Task) => void }) {
  const done = task.status === 'done'
  const overdue = isOverdue(task)
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.03] transition-colors duration-200">
      <button
        onClick={() => onToggle(task)}
        aria-label={done ? 'Mark incomplete' : 'Mark complete'}
        className={cn(
          'shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200',
          done
            ? 'bg-emerald-500/80 border-emerald-400 text-white'
            : 'border-white/25 hover:border-sky-400 text-transparent'
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('relative text-sm font-medium transition-all duration-300', done ? 'text-slate-500' : 'text-white')}>
            {task.title}
            <span
              className="absolute left-0 top-1/2 h-px bg-slate-500 transition-all duration-300 ease-out"
              style={{ width: done ? '100%' : '0%' }}
            />
          </span>
          {task.client && (
            <Link
              href={`/clients/${task.client.id}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/25 hover:bg-sky-500/25 transition-colors"
            >
              <Building2 className="h-3 w-3" />
              {task.client.company_name}
            </Link>
          )}
        </div>
      </div>

      {task.due_date && (
        <span className={cn('shrink-0 inline-flex items-center gap-1 text-xs', overdue ? 'text-red-400 font-medium' : 'text-slate-400')}>
          {overdue ? <AlertTriangle className="h-3 w-3" /> : <CalendarDays className="h-3 w-3" />}
          {formatDue(task.due_date)}
        </span>
      )}

      <span
        title={`Priority: ${task.priority}`}
        className={cn('shrink-0 w-2 h-2 rounded-full', PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium)}
      />

      <span className="shrink-0 text-xs text-slate-400 hidden sm:block w-28 truncate text-right">
        {task.assignee?.full_name || 'Unassigned'}
      </span>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.05] last:border-b-0">
      <div className="skeleton w-5 h-5 rounded-md shrink-0" />
      <div className="skeleton h-3.5 w-1/3 rounded" />
      <div className="skeleton h-4 w-20 rounded-full" />
      <div className="flex-1" />
      <div className="skeleton h-3 w-14 rounded" />
      <div className="skeleton w-2 h-2 rounded-full shrink-0" />
    </div>
  )
}

export default function TasksPage() {
  const [tab, setTab] = useState<Tab>('my')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Modal state
  const [clients, setClients] = useState<ClientOption[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', client_id: '', assigned_to: '', due_date: '', priority: 'medium' })

  const fetchTasks = useCallback(async (activeTab: Tab, withSpinner = true) => {
    if (withSpinner) setLoading(true)
    const params = new URLSearchParams()
    if (activeTab === 'my') params.set('assignee', 'me')
    if (activeTab === 'overdue') params.set('overdue', '1')
    if (activeTab === 'completed') params.set('status', 'done')
    try {
      const res = await fetch(`/api/tasks?${params.toString()}`)
      const data = await res.json()
      if (data?.__unavailable) {
        setUnavailable(true)
        setTasks([])
      } else {
        setUnavailable(false)
        setTasks(Array.isArray(data) ? data : [])
      }
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks(tab)
  }, [tab, fetchTasks])

  useEffect(() => {
    if (!modalOpen) return
    fetch('/api/clients?limit=200')
      .then(r => r.json())
      .then(d => setClients(d?.clients || []))
      .catch(() => setClients([]))
    fetch('/api/team')
      .then(r => r.json())
      .then(d => setTeam(Array.isArray(d) ? d : []))
      .catch(() => setTeam([]))
  }, [modalOpen])

  const visibleTasks = useMemo(() => {
    if (tab === 'completed') return tasks.filter(t => t.status === 'done')
    return tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled')
  }, [tasks, tab])

  const groups = useMemo(() => groupTasks(visibleTasks), [visibleTasks])

  async function toggleTask(task: Task) {
    const completed = task.status !== 'done'
    // Optimistic update so the strikethrough animates immediately
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: completed ? 'done' : 'open' } : t)))
    const res = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, completed }),
    })
    if (!res.ok) {
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: task.status } : t)))
      return
    }
    // Let the animation play before the row moves out of a filtered tab
    setTimeout(() => fetchTasks(tab, false), 600)
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          client_id: form.client_id || null,
          assigned_to: form.assigned_to || null,
          due_date: form.due_date || null,
          priority: form.priority,
        }),
      })
      if (res.ok) {
        setModalOpen(false)
        setForm({ title: '', client_id: '', assigned_to: '', due_date: '', priority: 'medium' })
        fetchTasks(tab, false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Tasks</h1>
          <p className="text-sm text-slate-400 mt-0.5">Everything on your plate, across every client</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-brand inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium">
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07] w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
              tab === t.key ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="glass-card rounded-2xl overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : unavailable ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <h2 className="text-white font-medium mb-1">Tasks not enabled</h2>
          <p className="text-sm text-slate-400">Run migration 012 + 022 to enable tasks</p>
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <CheckSquare className="h-8 w-8 text-slate-500 mx-auto mb-3" />
          <h2 className="text-white font-medium mb-1">
            {tab === 'completed' ? 'No completed tasks yet' : tab === 'overdue' ? 'Nothing overdue' : 'All clear'}
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            {tab === 'overdue' ? 'You are on top of everything.' : 'Create a task to get started.'}
          </p>
          {tab !== 'completed' && tab !== 'overdue' && (
            <button onClick={() => setModalOpen(true)} className="btn-brand inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium">
              <Plus className="h-4 w-4" />
              New Task
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.key}>
              <h2 className={cn('text-xs font-semibold uppercase tracking-wider mb-2 px-1', group.headerClass)}>
                {group.label}
                <span className="ml-2 text-slate-500 font-normal">{group.tasks.length}</span>
              </h2>
              <div className="glass-card rounded-2xl overflow-hidden">
                {group.tasks.map(task => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Task modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative glass-card rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">New Task</h2>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-xl bg-white/[0.06] text-slate-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
                <input
                  autoFocus
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="What needs to be done?"
                  className="input-glass w-full px-3 py-2 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Client</label>
                <select
                  value={form.client_id}
                  onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                  className="input-glass w-full px-3 py-2 rounded-xl text-sm"
                >
                  <option value="">No client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Assignee</label>
                <select
                  value={form.assigned_to}
                  onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                  className="input-glass w-full px-3 py-2 rounded-xl text-sm"
                >
                  <option value="">Unassigned</option>
                  {team.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Due date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="input-glass w-full px-3 py-2 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="input-glass w-full px-3 py-2 rounded-xl text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.title.trim()}
                  className="btn-brand px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  {saving ? 'Creating…' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
