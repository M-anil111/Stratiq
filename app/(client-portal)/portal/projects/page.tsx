'use client'
import { useEffect, useState } from 'react'
import { Globe, ExternalLink } from 'lucide-react'

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  hold: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-700',
  onboarding: 'bg-violet-100 text-violet-800',
}

export default function PortalProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/projects').then(r => r.json()).then(d => { setProjects(d || []); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="p-4 lg:p-8 space-y-4">
      {[1,2].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Projects</h1>
      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          <Globe className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No projects yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map(project => (
            <div key={project.id} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-4 w-4 text-gray-400" />
                    <h2 className="font-semibold text-gray-900">{project.domain}</h2>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[project.status] || ''}`}>
                      {project.status}
                    </span>
                  </div>
                  {project.services?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {project.services.map((s: string) => (
                        <span key={s} className="px-2 py-0.5 bg-sky-50 text-sky-700 text-xs rounded-full">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
