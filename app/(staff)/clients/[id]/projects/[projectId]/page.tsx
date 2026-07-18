import Link from 'next/link'
import { ChevronLeft, Edit, FileText, ArrowRight } from 'lucide-react'
import ProjectTabs from './ProjectTabs'

export default async function ProjectDetailPage({ params }: { params: { id: string; projectId: string } }) {
  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/clients/${params.id}`} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
          <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </Link>
        <div className="flex-1">
          <nav className="text-[13px] text-slate-500 dark:text-slate-400">
            <Link href="/clients" className="hover:text-sky-500 dark:hover:text-sky-400 transition-colors">Clients</Link>
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">/</span>
            <Link href={`/clients/${params.id}`} className="hover:text-sky-500 dark:hover:text-sky-400 transition-colors">Client</Link>
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">/</span>
            <span className="text-slate-700 dark:text-slate-300">Project</span>
          </nav>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white mt-0.5">Project Details</h1>
        </div>
        <Link href={`/clients/${params.id}/projects/${params.projectId}/edit`}
          className="flex items-center gap-2 px-3 py-2 border border-slate-900/10 dark:border-white/[0.08] rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-white/[0.06] transition-colors">
          <Edit className="h-4 w-4" />
          <span className="hidden sm:inline">Edit</span>
        </Link>
      </div>

      {/* View Submissions CTA */}
      <Link
        href={`/clients/${params.id}/projects/${params.projectId}/submissions/social-media`}
        className="flex items-center justify-between p-5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl mb-6 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6" />
          <div>
            <p className="font-semibold">View Submission Details</p>
            <p className="text-sky-100 text-sm">Log and track all marketing activities</p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
      </Link>

      <ProjectTabs projectId={params.projectId} />
    </div>
  )
}
