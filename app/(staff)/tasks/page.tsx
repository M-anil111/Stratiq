'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  ListChecks, Plus, Loader2, FolderKanban, LayoutGrid, List as ListIcon,
  Check, Circle, AlertTriangle, ChevronLeft, PlugZap, Link2, Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import EmptyState from '@/components/ui/EmptyState'
import { Person, Project, Board, PHTaskLite, Stage } from './types'
import { Avatar, AvatarStack, LabelPill, PriorityPill, formatDue, dueBucket } from './ui'
import TaskDetailDrawer, { TaskRef } from './TaskDetailDrawer'
import NewTaskDrawer from './NewTaskDrawer'
import SyncProjects from './SyncProjects'

type Tab = 'my' | 'projects' | 'sync'
type ProjectView = 'board' | 'list'

export default function TasksPage() {
  const [status, setStatus] = useState<{ configured: boolean; account: string | null } | null>(null)
  const [tab, setTab] = useState<Tab>('my')
  const [people, setPeople] = useState<Person[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [taskRef, setTaskRef] = useState<TaskRef | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // My tasks
  const [myLoading, setMyLoading] = useState(false)
  const [myTasks, setMyTasks] = useState<PHTaskLite[]>([])
  const [myPartial, setMyPartial] = useState(false)
  const [myMatched, setMyMatched] = useState(true)

  // Project board
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectView, setProjectView] = useState<ProjectView>('board')
  const [board, setBoard] = useState<Board | null>(null)
  const [boardLoading, setBoardLoading] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [workflowFilter, setWorkflowFilter] = useState<number | null>(null)

  // ---- initial status + shared data ----
  useEffect(() => {
    fetch('/api/proofhub/status')
      .then((r) => r.json())
      .then((j) => setStatus({ configured: !!j.configured, account: j.account || null }))
      .catch(() => setStatus({ configured: false, account: null }))
  }, [])

  const loadShared = useCallback(async () => {
    try {
      const [pplRes, projRes] = await Promise.all([
        fetch('/api/proofhub/people'),
        fetch('/api/proofhub/projects'),
      ])
      const ppl = await pplRes.json()
      const proj = await projRes.json()
      setPeople(Array.isArray(ppl.people) ? ppl.people : [])
      setProjects(Array.isArray(proj.projects) ? proj.projects : [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (status?.configured) loadShared()
  }, [status?.configured, loadShared])

  // ---- my tasks ----
  const loadMyTasks = useCallback(async () => {
    setMyLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/proofhub/my-tasks')
      const j = await res.json()
      if (!res.ok) throw new Error(j.message || j.error || 'Failed to load your tasks')
      setMyTasks(Array.isArray(j.tasks) ? j.tasks : [])
      setMyPartial(!!j.partial)
      setMyMatched(j.matched !== false)
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load your tasks')
    } finally {
      setMyLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status?.configured && tab === 'my') loadMyTasks()
  }, [status?.configured, tab, loadMyTasks])

  // ---- board ----
  const loadBoard = useCallback(async (projectId: number, completed: boolean) => {
    setBoardLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/proofhub/projects/${projectId}/board${completed ? '?completed=1' : ''}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.message || j.error || 'Failed to load board')
      setBoard(j)
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load board')
    } finally {
      setBoardLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedProject) loadBoard(selectedProject.id, showCompleted)
  }, [selectedProject, showCompleted, loadBoard])

  function refresh() {
    if (tab === 'my') loadMyTasks()
    if (selectedProject) loadBoard(selectedProject.id, showCompleted)
  }

  async function quickComplete(t: PHTaskLite, projectId: number, todolistId: number) {
    try {
      const res = await fetch(`/api/proofhub/tasks/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, todolistId, complete: !t.completed }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.message || json.error || 'Failed to update task')
      }
    } catch (e: any) {
      setLoadError(e.message || 'Failed to update task')
    } finally {
      refresh()
    }
  }

  async function moveTaskToStage(t: PHTaskLite, projectId: number, todolistId: number, stage: number) {
    try {
      const res = await fetch(`/api/proofhub/tasks/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, todolistId, stage, moveStage: true }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.message || json.error || 'Failed to move task')
      }
    } catch (e: any) {
      setLoadError(e.message || 'Failed to move task')
    } finally {
      if (selectedProject) loadBoard(selectedProject.id, showCompleted)
    }
  }

  // ---- render: connect state ----
  if (status && !status.configured) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="glass-card rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-sky-500/30">
            <PlugZap className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Connect ProofHub</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Tasks are powered by ProofHub. An administrator needs to set the{' '}
            <code className="px-1.5 py-0.5 rounded bg-slate-900/[0.06] dark:bg-white/10 text-xs">PROOFHUB_API_KEY</code> and{' '}
            <code className="px-1.5 py-0.5 rounded bg-slate-900/[0.06] dark:bg-white/10 text-xs">PROOFHUB_ACCOUNT_URL</code>{' '}
            environment variables to enable this module.
          </p>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 lg:py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
            <ListChecks className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white leading-tight">Tasks</h1>
            {status.account && <p className="text-xs text-slate-500">ProofHub · {status.account}</p>}
          </div>
        </div>
        <button onClick={() => setNewTaskOpen(true)} className="btn-brand rounded-lg px-3.5 py-2 text-sm inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> New task
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-900/[0.06] dark:border-white/[0.06]">
        <TabButton active={tab === 'my'} onClick={() => { setTab('my'); setSelectedProject(null) }} icon={<ListChecks className="h-4 w-4" />} label="My Tasks" />
        <TabButton active={tab === 'projects'} onClick={() => setTab('projects')} icon={<FolderKanban className="h-4 w-4" />} label="Projects" />
        <TabButton active={tab === 'sync'} onClick={() => { setTab('sync'); setSelectedProject(null) }} icon={<Link2 className="h-4 w-4" />} label="Sync / Link" />
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {loadError}
        </div>
      )}

      {/* MY TASKS */}
      {tab === 'my' && (
        <MyTasksView
          loading={myLoading}
          tasks={myTasks}
          people={people}
          partial={myPartial}
          matched={myMatched}
          onOpen={(t) => setTaskRef({ taskId: t.id, projectId: (t._project?.id ?? t.project?.id)!, todolistId: (t._list?.id ?? t.list?.id)! })}
          onComplete={(t) => quickComplete(t, (t._project?.id ?? t.project?.id)!, (t._list?.id ?? t.list?.id)!)}
        />
      )}

      {/* SYNC / LINK */}
      {tab === 'sync' && <SyncProjects />}

      {/* PROJECTS */}
      {tab === 'projects' && !selectedProject && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.length === 0 && <p className="text-sm text-slate-500">No projects found in ProofHub.</p>}
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedProject(p); setProjectView('board') }}
              className="glass-card rounded-xl p-4 text-left hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <FolderKanban className="h-4 w-4 text-sky-500" />
                <span className="font-medium text-slate-900 dark:text-white truncate">{p.name}</span>
              </div>
              {p.description && <p className="text-xs text-slate-500 line-clamp-2">{p.description}</p>}
            </button>
          ))}
        </div>
      )}

      {tab === 'projects' && selectedProject && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <button onClick={() => { setSelectedProject(null); setBoard(null) }} className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Projects
            </button>
            <span className="font-semibold text-slate-900 dark:text-white">{selectedProject.name}</span>
            <div className="flex items-center gap-1 rounded-lg bg-slate-900/[0.05] dark:bg-white/[0.06] p-0.5">
              <ViewToggle active={projectView === 'board'} onClick={() => setProjectView('board')} icon={<LayoutGrid className="h-4 w-4" />} label="Board" />
              <ViewToggle active={projectView === 'list'} onClick={() => setProjectView('list')} icon={<ListIcon className="h-4 w-4" />} label="List" />
            </div>
          </div>

          {/* Board controls: workflow filter + completed/historical toggle */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                showCompleted
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-900/[0.04] dark:bg-white/[0.04] border-slate-900/10 dark:border-white/10 text-slate-600 dark:text-slate-300'
              )}
            >
              <Check className="h-3.5 w-3.5" /> {showCompleted ? 'Showing completed' : 'Show completed'}
            </button>
            {board && board.workflows.length > 1 && (
              <div className="inline-flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-slate-500" />
                <select
                  value={workflowFilter ?? ''}
                  onChange={(e) => setWorkflowFilter(e.target.value ? Number(e.target.value) : null)}
                  className="input-glass text-xs py-1.5"
                  aria-label="Filter by board / workflow"
                >
                  <option value="">All boards ({board.workflows.length})</option>
                  {board.workflows.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {board?.partial && (
            <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              Showing a capped subset of lists to stay within ProofHub rate limits.
            </div>
          )}

          <div className="mb-4 rounded-lg bg-slate-900/[0.03] dark:bg-white/[0.03] border border-slate-900/10 dark:border-white/10 px-3 py-2 text-[11px] text-slate-500">
            Board templates aren&apos;t exposed by the ProofHub API, so template selection is unavailable. Global/account activity feeds are also not exposed — per-task activity is available inside each task.
          </div>

          {boardLoading && (
            <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
          )}

          {!boardLoading && board && projectView === 'board' && (
            <BoardView
              board={board}
              people={people}
              workflowFilter={workflowFilter}
              onOpen={(t, listId) => setTaskRef({ taskId: t.id, projectId: board.projectId, todolistId: listId })}
              onMove={(t, listId, stage) => moveTaskToStage(t, board.projectId, listId, stage)}
            />
          )}

          {!boardLoading && board && projectView === 'list' && (
            <ListView
              board={board}
              people={people}
              onOpen={(t, listId) => setTaskRef({ taskId: t.id, projectId: board.projectId, todolistId: listId })}
              onComplete={(t, listId) => quickComplete(t, board.projectId, listId)}
            />
          )}
        </div>
      )}

      <TaskDetailDrawer
        taskRef={taskRef}
        people={people}
        stages={board?.stages || []}
        onClose={() => setTaskRef(null)}
        onChanged={refresh}
      />
      <NewTaskDrawer
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        projects={projects}
        people={people}
        defaultProjectId={selectedProject?.id ?? null}
        onCreated={refresh}
      />
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
        active ? 'border-sky-500 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
      )}
    >
      {icon} {label}
    </button>
  )
}

function ViewToggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
        active ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
      )}
    >
      {icon} {label}
    </button>
  )
}

// ---- My Tasks view ----
const MY_GROUPS: { key: ReturnType<typeof dueBucket>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'later', label: 'Later' },
  { key: 'none', label: 'No due date' },
]

function MyTasksView({
  loading, tasks, people, partial, matched, onOpen, onComplete,
}: {
  loading: boolean
  tasks: PHTaskLite[]
  people: Person[]
  partial: boolean
  matched: boolean
  onOpen: (t: PHTaskLite) => void
  onComplete: (t: PHTaskLite) => void
}) {
  if (loading) return <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
  if (!matched)
    return (
      <div className="glass-card rounded-xl p-8 text-center text-sm text-slate-500">
        Your Stratiq email doesn&apos;t match a ProofHub person, so we can&apos;t find your assigned tasks.
      </div>
    )
  if (tasks.length === 0)
    return <div className="glass-card rounded-xl p-8 text-center text-sm text-slate-500">No open tasks assigned to you.</div>

  return (
    <div className="space-y-6">
      {partial && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Partial results — a capped number of projects/lists were scanned to respect ProofHub rate limits.
        </div>
      )}
      {MY_GROUPS.map((g) => {
        const items = tasks.filter((t) => dueBucket(t.due_date) === g.key)
        if (items.length === 0) return null
        return (
          <div key={g.key}>
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 px-1">
              {g.label} <span className="text-slate-400">· {items.length}</span>
            </h2>
            <div className="space-y-1.5">
              {items.map((t) => (
                <TaskRow key={t.id} task={t} people={people} onOpen={onOpen} onComplete={onComplete} showProject />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TaskRow({
  task, people, onOpen, onComplete, showProject,
}: {
  task: PHTaskLite
  people: Person[]
  onOpen: (t: PHTaskLite) => void
  onComplete: (t: PHTaskLite) => void
  showProject?: boolean
}) {
  const due = formatDue(task.due_date)
  const assigned = Array.isArray(task.assigned) ? task.assigned.map(Number) : []
  const projName = task._project?.name || task.project?.name
  return (
    <div className="glass-card rounded-xl px-3 py-2.5 flex items-center gap-3 hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.04] transition-colors">
      <button onClick={() => onComplete(task)} className="shrink-0 text-slate-400 hover:text-emerald-500 transition-colors" aria-label="Complete">
        {task.completed ? <Check className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5" />}
      </button>
      <button onClick={() => onOpen(task)} className="min-w-0 flex-1 text-left">
        <div className={cn('text-sm font-medium truncate', task.completed ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white')}>
          {task.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {showProject && projName && <span className="text-[11px] text-slate-500">{projName}</span>}
          <PriorityPill customFields={task.custom_fields} />
          {Array.isArray(task.labels) && task.labels.slice(0, 3).map((l) => <LabelPill key={l.id} label={l} />)}
        </div>
      </button>
      {due && <span className={cn('text-xs font-medium shrink-0', due.tone)} suppressHydrationWarning>{due.text}</span>}
      {assigned.length > 0 && <div className="shrink-0"><AvatarStack ids={assigned} people={people} size={22} /></div>}
    </div>
  )
}

// ---- Board (kanban) ----
function BoardView({
  board, people, workflowFilter, onOpen, onMove,
}: {
  board: Board
  people: Person[]
  workflowFilter: number | null
  onOpen: (t: PHTaskLite, listId: number) => void
  onMove: (t: PHTaskLite, listId: number, stage: number) => void
}) {
  const matchWorkflow = (t: PHTaskLite) => workflowFilter == null || t.workflow?.id === workflowFilter
  const allTasks = board.lists
    .flatMap((l) => l.tasks.map((t) => ({ t, listId: l.id })))
    .filter(({ t }) => matchWorkflow(t))
  const completed = (board.completedTasks || []).filter(matchWorkflow)
  const stages: Stage[] = board.stages.length ? board.stages : [{ id: -1, name: 'Tasks' }]

  // group by stage id; tasks with no stage go under the first column
  function tasksForStage(stageId: number) {
    return allTasks.filter(({ t }) => {
      const sid = t.stage?.id ?? null
      if (stageId === stages[0].id) return sid === stageId || sid == null
      return sid === stageId
    })
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const items = tasksForStage(stage.id)
        return (
          <div key={stage.id} className="shrink-0 w-72">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{stage.name}</span>
              <span className="text-[11px] text-slate-400">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map(({ t, listId }) => {
                const assigned = Array.isArray(t.assigned) ? t.assigned.map(Number) : []
                const due = formatDue(t.due_date)
                return (
                  <div key={t.id} className="glass-card rounded-xl p-3">
                    <button onClick={() => onOpen(t, listId)} className="w-full text-left">
                      <div className={cn('text-sm font-medium mb-1.5', t.completed ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white')}>
                        {t.title}
                      </div>
                      {(Array.isArray(t.labels) && t.labels.length > 0) || t.custom_fields?.some((f) => (f.type || '').toLowerCase() === 'priority') ? (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          <PriorityPill customFields={t.custom_fields} />
                          {Array.isArray(t.labels) && t.labels.slice(0, 3).map((l) => <LabelPill key={l.id} label={l} />)}
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-2">
                        {due ? <span className={cn('text-[11px] font-medium', due.tone)} suppressHydrationWarning>{due.text}</span> : <span />}
                        {assigned.length > 0 && <AvatarStack ids={assigned} people={people} size={20} />}
                      </div>
                    </button>
                    {board.stages.length > 1 && (
                      <select
                        value={t.stage?.id ?? ''}
                        onChange={(e) => e.target.value && onMove(t, listId, Number(e.target.value))}
                        className="input-glass text-[11px] w-full mt-2 py-1"
                        aria-label="Move to stage"
                      >
                        {!t.stage && <option value="">Move to…</option>}
                        {board.stages.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
              {items.length === 0 && <EmptyState icon={ListChecks} title="No tasks" size="sm" />}
            </div>
          </div>
        )
      })}

      {/* Completed / historical column */}
      {board.includeCompleted && (
        <div className="shrink-0 w-72">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Completed</span>
            <span className="text-[11px] text-slate-400">{completed.length}</span>
          </div>
          <div className="space-y-2">
            {completed.map((t) => {
              const assigned = Array.isArray(t.assigned) ? t.assigned.map(Number) : []
              return (
                <div key={t.id} className="glass-card rounded-xl p-3 opacity-75">
                  <div className="text-sm font-medium mb-1.5 text-slate-400 line-through">{t.title}</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">{t._project?.name || t.project?.name || ''}</span>
                    {assigned.length > 0 && <AvatarStack ids={assigned} people={people} size={20} />}
                  </div>
                </div>
              )
            })}
            {completed.length === 0 && <EmptyState icon={Check} title="No completed tasks" size="sm" />}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- List view (grouped by todolist) ----
function ListView({
  board, people, onOpen, onComplete,
}: {
  board: Board
  people: Person[]
  onOpen: (t: PHTaskLite, listId: number) => void
  onComplete: (t: PHTaskLite, listId: number) => void
}) {
  return (
    <div className="space-y-6">
      {board.lists.map((l) => (
        <div key={l.id}>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 px-1">
            {l.name} <span className="text-slate-400">· {l.tasks.length}</span>
          </h2>
          <div className="space-y-1.5">
            {l.tasks.map((t) => (
              <TaskRow key={t.id} task={t} people={people} onOpen={(tk) => onOpen(tk, l.id)} onComplete={(tk) => onComplete(tk, l.id)} />
            ))}
            {l.tasks.length === 0 && <EmptyState icon={ListChecks} title="No tasks" size="sm" />}
          </div>
        </div>
      ))}
      {board.lists.length === 0 && <EmptyState icon={FolderKanban} title="No lists in this project" size="sm" />}
    </div>
  )
}
