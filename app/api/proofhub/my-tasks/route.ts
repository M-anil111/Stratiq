import { NextResponse } from 'next/server'
import { listProjects, listTodolists, listTasks, listPeople, personName, PHTask } from '@/lib/proofhub'
import { requireStratiqUser, ensureConfigured, notConfigured, phErrorResponse } from '../_helpers'

export const dynamic = 'force-dynamic'

// Rate-limit budget: 25 requests / 10s. We cap the crawl so a single load
// never blows the budget. Anything beyond the cap returns partial:true.
// Requests used: 1 (people) + 1 (projects) + N projects*(1 todolists + M lists).
const MAX_PROJECTS = 6
const MAX_LISTS_PER_PROJECT = 4

export async function GET() {
  const { user, res } = await requireStratiqUser()
  if (res) return res
  if (!ensureConfigured()) return notConfigured()

  try {
    const people = await listPeople()
    const email = (user?.email || '').trim().toLowerCase()
    const me = people.find((p) => (p.email || '').trim().toLowerCase() === email)

    if (!me) {
      // Stratiq user isn't a ProofHub person → nothing assigned to them.
      return NextResponse.json({
        configured: true,
        matched: false,
        tasks: [],
        partial: false,
        message: 'Your Stratiq email does not match a ProofHub person.',
      })
    }

    const myId = me.id
    const projects = await listProjects()
    const scanProjects = projects.slice(0, MAX_PROJECTS)
    let partial = projects.length > scanProjects.length

    const collected: (PHTask & { _project?: { id: number; name: string }; _list?: { id: number; name: string } })[] = []

    for (const project of scanProjects) {
      let todolists: Awaited<ReturnType<typeof listTodolists>> = []
      try {
        todolists = await listTodolists(project.id)
      } catch {
        continue
      }
      const scanLists = todolists.slice(0, MAX_LISTS_PER_PROJECT)
      if (todolists.length > scanLists.length) partial = true

      for (const tl of scanLists) {
        let tasks: PHTask[] = []
        try {
          tasks = await listTasks(project.id, tl.id)
        } catch {
          continue
        }
        for (const t of tasks) {
          if (Array.isArray(t.assigned) && t.assigned.map(Number).includes(myId) && !t.completed) {
            collected.push({
              ...t,
              _project: { id: project.id, name: project.name },
              _list: { id: tl.id, name: (tl.title || tl.name || `List ${tl.id}`) as string },
            })
          }
        }
      }
    }

    return NextResponse.json({
      configured: true,
      matched: true,
      person: { id: myId, name: personName(me), email: me.email || null },
      tasks: collected,
      partial,
    })
  } catch (e) {
    return phErrorResponse(e)
  }
}
