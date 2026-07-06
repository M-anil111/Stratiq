'use client'
import { useState, useEffect, useCallback } from 'react'
import { Check, Loader2, MessageSquare, Send, ListTree, Tag, Calendar, Users, Activity as ActivityIcon } from 'lucide-react'
import SlideOver from '@/components/SlideOver'
import { Person, Stage, PHTaskLite, Activity } from './types'
import { Avatar, LabelPill } from './ui'
import { sanitizeHtml } from '@/lib/sanitize-html'

export type TaskRef = { taskId: number; projectId: number; todolistId: number }

export default function TaskDetailDrawer({
  taskRef,
  people,
  stages,
  onClose,
  onChanged,
}: {
  taskRef: TaskRef | null
  people: Person[]
  stages: Stage[]
  onClose: () => void
  onChanged: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [task, setTask] = useState<PHTaskLite | null>(null)
  const [subtasks, setSubtasks] = useState<PHTaskLite[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [saving, setSaving] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!taskRef) return
    setLoading(true)
    setError(null)
    try {
      const qs = `projectId=${taskRef.projectId}&todolistId=${taskRef.todolistId}`
      const [tRes, cRes, hRes] = await Promise.all([
        fetch(`/api/proofhub/tasks/${taskRef.taskId}?${qs}`),
        fetch(`/api/proofhub/tasks/${taskRef.taskId}/comments?${qs}`),
        fetch(`/api/proofhub/tasks/${taskRef.taskId}/history?${qs}`),
      ])
      const tJson = await tRes.json()
      if (!tRes.ok) throw new Error(tJson.message || tJson.error || 'Failed to load task')
      setTask(tJson.task)
      setSubtasks(Array.isArray(tJson.subtasks) ? tJson.subtasks : [])
      const cJson = await cRes.json()
      setComments(Array.isArray(cJson.comments) ? cJson.comments : [])
      const hJson = await hRes.json().catch(() => ({}))
      setActivity(Array.isArray(hJson.activities) ? hJson.activities : [])
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [taskRef])

  useEffect(() => {
    setNewComment('')
    if (taskRef) load()
    else {
      setTask(null)
      setComments([])
      setSubtasks([])
      setActivity([])
      setError(null)
    }
  }, [taskRef, load])

  async function patch(body: Record<string, any>) {
    if (!taskRef) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/proofhub/tasks/${taskRef.taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: taskRef.projectId, todolistId: taskRef.todolistId, ...body }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || json.error || 'Update failed')
      await load()
      onChanged()
    } catch (e: any) {
      setError(e.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  function toggleAssignee(id: number) {
    if (!task) return
    const cur = Array.isArray(task.assigned) ? task.assigned.map(Number) : []
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    patch({ assignedIds: next })
  }

  async function submitComment() {
    if (!taskRef || !newComment.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/proofhub/tasks/${taskRef.taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: taskRef.projectId, todolistId: taskRef.todolistId, content: newComment.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || json.error || 'Comment failed')
      setNewComment('')
      await load()
    } catch (e: any) {
      setError(e.message || 'Comment failed')
    } finally {
      setSaving(false)
    }
  }

  const assigned = task && Array.isArray(task.assigned) ? task.assigned.map(Number) : []
  const allStages = stages.length ? stages : task?.stage ? [task.stage] : []

  return (
    <SlideOver
      open={!!taskRef}
      onClose={onClose}
      widthClass="w-[560px]"
      title={
        <span className="flex items-center gap-2">
          {task?.completed && <Check className="h-5 w-5 text-emerald-500" />}
          <span className="truncate">{task?.title || 'Task'}</span>
        </span>
      }
    >
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && task && (
        <div className="space-y-6">
          {/* Complete toggle */}
          <button
            onClick={() => patch({ complete: !task.completed })}
            disabled={saving}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              task.completed
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                : 'bg-slate-900/[0.05] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-900/10 dark:border-white/10 hover:bg-emerald-500/10'
            }`}
          >
            <Check className="h-4 w-4" />
            {task.completed ? 'Completed' : 'Mark complete'}
          </button>

          {/* Meta */}
          <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
            {task.project?.name && <span>Project: {task.project.name}</span>}
            {task.list?.name && <span>List: {task.list.name}</span>}
            {task.workflow?.name && <span>Board: {task.workflow.name}</span>}
          </div>

          {/* Description */}
          {task.description && (
            <div
              className="prose-sm text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.description) }}
            />
          )}

          {/* Stage selector */}
          {allStages.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                <ListTree className="h-3.5 w-3.5" /> Stage
              </div>
              <select
                value={task.stage?.id ?? ''}
                onChange={(e) => e.target.value && patch({ stage: Number(e.target.value), moveStage: true })}
                disabled={saving}
                className="input-glass text-sm w-full"
              >
                {!task.stage && <option value="">Select stage</option>}
                {allStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Due date */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              <Calendar className="h-3.5 w-3.5" /> Due date
            </div>
            <input
              type="date"
              key={task.id}
              defaultValue={task.due_date ? String(task.due_date).slice(0, 10) : ''}
              onChange={(e) => patch({ due_date: e.target.value })}
              disabled={saving}
              className="input-glass text-sm"
            />
          </div>

          {/* Assignees */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              <Users className="h-3.5 w-3.5" /> Assignees
            </div>
            <div className="flex flex-wrap gap-1.5">
              {people.map((p) => {
                const on = assigned.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleAssignee(p.id)}
                    disabled={saving}
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

          {/* Labels */}
          {Array.isArray(task.labels) && task.labels.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                <Tag className="h-3.5 w-3.5" /> Labels
              </div>
              <div className="flex flex-wrap gap-1.5">
                {task.labels.map((l) => (
                  <LabelPill key={l.id} label={l} />
                ))}
              </div>
            </div>
          )}

          {/* Subtasks (read) */}
          {subtasks.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                <ListTree className="h-3.5 w-3.5" /> Subtasks
              </div>
              <ul className="space-y-1.5">
                {subtasks.map((st, i) => (
                  <li key={st.id ?? i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <Check className={`h-3.5 w-3.5 ${st.completed ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
                    <span className={st.completed ? 'line-through text-slate-400' : ''}>{st.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Comments */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              <MessageSquare className="h-3.5 w-3.5" /> Comments
            </div>
            <div className="space-y-3 mb-3">
              {comments.length === 0 && <p className="text-xs text-slate-500">No comments yet.</p>}
              {comments.map((c, i) => (
                <div key={c.id ?? i} className="glass-card rounded-lg p-3 text-sm">
                  <div
                    className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.content || c.body || '') }}
                  />
                  {c.created_at && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      <span suppressHydrationWarning>{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment…"
                rows={2}
                className="input-glass text-sm flex-1 resize-none"
              />
              <button
                onClick={submitComment}
                disabled={saving || !newComment.trim()}
                className="btn-brand rounded-lg p-2.5 disabled:opacity-50"
                aria-label="Send comment"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Activity (task history) */}
          {activity.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                <ActivityIcon className="h-3.5 w-3.5" /> Activity
              </div>
              <ul className="space-y-2.5 border-l border-slate-900/10 dark:border-white/10 pl-3">
                {activity.map((a, i) => (
                  <li key={a.id ?? i} className="text-sm text-slate-600 dark:text-slate-300">
                    <div
                      className="whitespace-pre-wrap break-words"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.description || a.content || a.action || 'Activity') }}
                    />
                    {a.created_at && (
                      <div className="text-[11px] text-slate-400 mt-0.5" suppressHydrationWarning>{new Date(a.created_at).toLocaleString()}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SlideOver>
  )
}
