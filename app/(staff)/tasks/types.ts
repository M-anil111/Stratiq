export type PHLabel = { id: number; name: string; color?: string }

export type PHTaskLite = {
  id: number
  title: string
  description?: string
  due_date?: string | null
  start_date?: string | null
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
  created_at?: string
  updated_at?: string
  // enriched by my-tasks
  _project?: { id: number; name: string }
  _list?: { id: number; name: string }
}

export type Person = {
  id: number
  name: string
  email: string | null
  avatar: string | null
}

export type Project = { id: number; name: string; description?: string }

export type Stage = { id: number; name: string }

export type BoardList = { id: number; name: string; tasks: PHTaskLite[] }

export type Board = {
  configured: boolean
  projectId: number
  lists: BoardList[]
  stages: Stage[]
  partial: boolean
}
