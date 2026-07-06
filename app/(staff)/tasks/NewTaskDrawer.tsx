'use client'
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import SlideOver from '@/components/SlideOver'
import { Person, Project } from './types'
import { Avatar } from './ui'

type Todolist = { id: number; name: string }

export default function NewTaskDrawer({
  open,
  onClose,
  projects,
  people,
  defaultProjectId,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  projects: Project[]
  people: Person[]
  defaultProjectId?: number | null
  onCreated: () => void
}) {
  const [projectId, setProjectId] = useState<number | ''>('')
  const [todolistId, setTodolistId] = useState<number | ''>('')
  const [todolists, setTodolists] = useState<Todolist[]>([])
  const [loadingLists, setLoadingLists] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [assignedIds, setAssignedIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setProjectId(defaultProjectId || '')
      setTodolistId('')
      setTitle('')
      setDescription('')
      setDueDate('')
      setAssignedIds([])
      setError(null)
    }
  }, [open, defaultProjectId])

  // Load todolists for the chosen project via the board endpoint.
  useEffect(() => {
    if (!projectId) {
      setTodolists([])
      return
    }
    let cancel = false
    setLoadingLists(true)
    fetch(`/api/proofhub/projects/${projectId}/board`)
      .then((r) => r.json())
      .then((j) => {
        if (cancel) return
        const lists = Array.isArray(j.lists) ? j.lists.map((l: any) => ({ id: l.id, name: l.name })) : []
        setTodolists(lists)
        if (lists.length === 1) setTodolistId(lists[0].id)
      })
      .catch(() => !cancel && setTodolists([]))
      .finally(() => !cancel && setLoadingLists(false))
    return () => {
      cancel = true
    }
  }, [projectId])

  async function submit() {
    if (!projectId || !todolistId || !title.trim()) {
      setError('Project, list and title are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/proofhub/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          todolistId,
          title: title.trim(),
          description: description.trim() || undefined,
          due_date: dueDate || undefined,
          assignedIds,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || json.error || 'Failed to create task')
      onCreated()
      onClose()
    } catch (e: any) {
      setError(e.message || 'Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  function toggleAssignee(id: number) {
    setAssignedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="New task"
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-900/[0.05] dark:bg-white/[0.06] hover:bg-slate-900/[0.08]"
          >
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="btn-brand rounded-lg px-4 py-2 text-sm disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create task
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} className="input-glass text-sm w-full">
            <option value="">Select a project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
            To-do list {loadingLists && <Loader2 className="inline h-3 w-3 animate-spin" />}
          </label>
          <select
            value={todolistId}
            onChange={(e) => setTodolistId(e.target.value ? Number(e.target.value) : '')}
            disabled={!projectId || loadingLists}
            className="input-glass text-sm w-full disabled:opacity-50"
          >
            <option value="">Select a list</option>
            {todolists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" className="input-glass text-sm w-full" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional details" className="input-glass text-sm w-full resize-none" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Due date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-glass text-sm" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Assignees</label>
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => {
              const on = assignedIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => toggleAssignee(p.id)}
                  className={`inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs border transition-colors ${
                    on
                      ? 'bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300'
                      : 'bg-slate-900/[0.03] dark:bg-white/[0.04] border-slate-900/10 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-900/[0.06]'
                  }`}
                >
                  <Avatar person={p} size={18} />
                  {p.name}
                </button>
              )
            })}
            {people.length === 0 && <span className="text-xs text-slate-500">No people found.</span>}
          </div>
        </div>
      </div>
    </SlideOver>
  )
}
