// Server-side ProofHub API v3 client.
//
// Source of truth for the Tasks module. Nothing task-related is persisted in
// our own DB — every read/write goes through ProofHub's REST API.
//
// Auth: X-API-KEY + a non-blank User-Agent are mandatory on EVERY request
// (blank UA → HTTP 400). Content-Type: application/json on POST/PUT.
//
// Rate limit: 25 requests / 10s per account+IP. We cache GETs for a short TTL
// and handle 429 (respect Retry-After, single retry) + transient 5xx.

const API_KEY = process.env.PROOFHUB_API_KEY || ''
const ACCOUNT_URL = (process.env.PROOFHUB_ACCOUNT_URL || '').replace(/\/+$/, '')
const USER_AGENT = 'Stratiq (noreply@stratiqnow.com)'
const CACHE_TTL_MS = 8000

export function proofhubConfigured(): boolean {
  return Boolean(API_KEY && ACCOUNT_URL)
}

export function proofhubAccount(): string {
  // Host portion, e.g. "company" from https://company.proofhub.com
  try {
    return new URL(ACCOUNT_URL).host
  } catch {
    return ACCOUNT_URL
  }
}

export class ProofHubError extends Error {
  status: number
  detail?: unknown
  constructor(message: string, status: number, detail?: unknown) {
    super(message)
    this.name = 'ProofHubError'
    this.status = status
    this.detail = detail
  }
}

// ---- tiny in-memory TTL cache (GETs only) --------------------------------
type CacheEntry = { expires: number; value: unknown }
const cache = new Map<string, CacheEntry>()

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key)
  if (!hit) return undefined
  if (hit.expires < Date.now()) {
    cache.delete(key)
    return undefined
  }
  return hit.value as T
}

function cacheSet(key: string, value: unknown) {
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value })
}

function invalidatePrefix(prefix: string) {
  const keys = Array.from(cache.keys())
  for (const k of keys) if (k.startsWith(prefix)) cache.delete(k)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---- core request --------------------------------------------------------
async function ph<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!proofhubConfigured()) {
    throw new ProofHubError('ProofHub is not configured', 503)
  }
  const method = (init.method || 'GET').toUpperCase()
  const url = `${ACCOUNT_URL}/api/v3/${path.replace(/^\/+/, '')}`

  const headers: Record<string, string> = {
    'X-API-KEY': API_KEY,
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (method === 'POST' || method === 'PUT') {
    headers['Content-Type'] = 'application/json'
  }

  const cacheKey = method === 'GET' ? `GET ${url}` : ''
  if (cacheKey) {
    const cached = cacheGet<T>(cacheKey)
    if (cached !== undefined) return cached
  }

  let attempt = 0
  // one extra retry allowed for 429 / transient 5xx
  while (true) {
    let res: Response
    try {
      res = await fetch(url, { ...init, method, headers, cache: 'no-store' })
    } catch (e) {
      throw new ProofHubError(`Network error reaching ProofHub: ${String(e)}`, 502)
    }

    if (res.ok) {
      const text = await res.text()
      const value = (text ? JSON.parse(text) : null) as T
      if (cacheKey) cacheSet(cacheKey, value)
      return value
    }

    // retry once on 429 / 5xx
    if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
      attempt++
      let waitMs = 1000
      const retryAfter = res.headers.get('Retry-After')
      if (retryAfter) {
        const secs = Number(retryAfter)
        if (!Number.isNaN(secs)) waitMs = Math.min(secs * 1000, 10000)
      }
      await sleep(waitMs)
      continue
    }

    let detail: unknown
    try {
      detail = await res.json()
    } catch {
      detail = await res.text().catch(() => undefined)
    }
    throw new ProofHubError(
      `ProofHub API ${res.status} for ${method} ${path}`,
      res.status,
      detail
    )
  }
}

// ---- types ---------------------------------------------------------------
export type PHProject = {
  id: number
  name: string
  description?: string
  [k: string]: unknown
}

export type PHTodolist = {
  id: number
  title?: string
  name?: string
  project?: { id: number; name: string }
  [k: string]: unknown
}

export type PHLabel = { id: number; name: string; color?: string }

export type PHStage = { id: number; name: string }

export type PHTask = {
  id: number
  title: string
  description?: string
  ticket?: string | number
  start_date?: string | null
  due_date?: string | null
  completed?: boolean
  percent_progress?: number
  assigned?: number[]
  labels?: PHLabel[]
  sub_tasks?: unknown[]
  comments?: unknown
  project?: { id: number; name: string }
  list?: { id: number; name: string }
  workflow?: { id: number; name: string }
  stage?: { id: number; name: string }
  task_history?: unknown[]
  created_at?: string
  updated_at?: string
  [k: string]: unknown
}

export type PHPerson = {
  id: number
  email?: string
  name?: string
  full_name?: string
  first_name?: string
  last_name?: string
  avatar?: string
  image_url?: string
  [k: string]: unknown
}

export type PHComment = {
  id: number
  content?: string
  body?: string
  created_by?: unknown
  created_at?: string
  [k: string]: unknown
}

// ProofHub responses sometimes wrap arrays under a key; normalize both shapes.
function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const key of ['data', 'projects', 'todolists', 'tasks', 'people', 'comments', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as T[]
    }
  }
  return []
}

// ---- task create/update body --------------------------------------------
export type TaskWriteBody = {
  title?: string
  description?: string
  start_date?: string
  due_date?: string
  estimated_hours?: number
  estimated_mins?: number
  assigned?: number[]
  labels?: number[]
  completed?: boolean
  stage?: number
  list_id?: number
  project?: number
  move_task?: boolean
}

// ---- exports -------------------------------------------------------------
export async function listProjects(): Promise<PHProject[]> {
  return asArray<PHProject>(await ph('projects'))
}

export async function getProject(p: number | string): Promise<PHProject> {
  return ph<PHProject>(`projects/${p}`)
}

export async function listTodolists(p: number | string): Promise<PHTodolist[]> {
  return asArray<PHTodolist>(await ph(`projects/${p}/todolists`))
}

export async function getTodolist(p: number | string, tl: number | string): Promise<PHTodolist> {
  return ph<PHTodolist>(`projects/${p}/todolists/${tl}`)
}

export async function listTasks(p: number | string, tl: number | string): Promise<PHTask[]> {
  return asArray<PHTask>(await ph(`projects/${p}/todolists/${tl}/tasks`))
}

export async function getTask(p: number | string, tl: number | string, t: number | string): Promise<PHTask> {
  return ph<PHTask>(`projects/${p}/todolists/${tl}/tasks/${t}`)
}

export async function createTask(p: number | string, tl: number | string, body: TaskWriteBody): Promise<PHTask> {
  const res = await ph<PHTask>(`projects/${p}/todolists/${tl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  invalidatePrefix(`GET ${ACCOUNT_URL}/api/v3/projects/${p}`)
  return res
}

export async function updateTask(
  p: number | string,
  tl: number | string,
  t: number | string,
  body: TaskWriteBody
): Promise<PHTask> {
  const res = await ph<PHTask>(`projects/${p}/todolists/${tl}/tasks/${t}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  invalidatePrefix(`GET ${ACCOUNT_URL}/api/v3/projects/${p}`)
  return res
}

export async function completeTask(
  p: number | string,
  tl: number | string,
  t: number | string,
  completed = true
): Promise<PHTask> {
  return updateTask(p, tl, t, { completed })
}

export async function moveTaskStage(
  p: number | string,
  tl: number | string,
  t: number | string,
  stage: number
): Promise<PHTask> {
  return updateTask(p, tl, t, {
    stage,
    list_id: Number(tl),
    project: Number(p),
    move_task: true,
  })
}

export async function listComments(p: number | string, tl: number | string, t: number | string): Promise<PHComment[]> {
  return asArray<PHComment>(await ph(`projects/${p}/todolists/${tl}/tasks/${t}/comments`))
}

export async function addComment(
  p: number | string,
  tl: number | string,
  t: number | string,
  content: string
): Promise<PHComment> {
  const res = await ph<PHComment>(`projects/${p}/todolists/${tl}/tasks/${t}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
  invalidatePrefix(`GET ${ACCOUNT_URL}/api/v3/projects/${p}/todolists/${tl}/tasks/${t}/comments`)
  return res
}

export async function listSubtasks(p: number | string, tl: number | string, t: number | string): Promise<PHTask[]> {
  return asArray<PHTask>(await ph(`projects/${p}/todolists/${tl}/tasks/${t}/subtasks`))
}

export async function listPeople(): Promise<PHPerson[]> {
  return asArray<PHPerson>(await ph('people'))
}

export async function getPerson(id: number | string): Promise<PHPerson> {
  return ph<PHPerson>(`people/${id}`)
}

export function personName(p: PHPerson): string {
  return (
    p.name ||
    p.full_name ||
    [p.first_name, p.last_name].filter(Boolean).join(' ') ||
    p.email ||
    `Person ${p.id}`
  )
}

// Resolve a list of emails to numeric ProofHub person IDs using cached /people.
export async function resolvePeopleByEmail(emails: string[]): Promise<Record<string, number>> {
  const people = await listPeople()
  const byEmail = new Map<string, number>()
  for (const person of people) {
    if (person.email) byEmail.set(person.email.trim().toLowerCase(), person.id)
  }
  const out: Record<string, number> = {}
  for (const email of emails) {
    const id = byEmail.get(email.trim().toLowerCase())
    if (id != null) out[email] = id
  }
  return out
}

// Harvest distinct stages from a project's tasks/workflows. There is no
// stage-discovery endpoint, so we derive columns from the tasks themselves.
export function harvestStages(tasks: PHTask[]): PHStage[] {
  const seen = new Map<number, string>()
  for (const t of tasks) {
    if (t.stage && typeof t.stage.id === 'number') {
      seen.set(t.stage.id, t.stage.name || `Stage ${t.stage.id}`)
    }
  }
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
}
