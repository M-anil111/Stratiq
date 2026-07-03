import Link from 'next/link'
import { ChevronLeft, Edit, FileText, ArrowRight } from 'lucide-react'

export default async function ProjectDetailPage({ params }: { params: { id: string; projectId: string } }) {
  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/clients/${params.id}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Project Details</h1>
          <nav className="text-sm text-gray-500 mt-0.5">
            <Link href="/clients" className="hover:text-sky-600">Clients</Link>
            {' › '}
            <Link href={`/clients/${params.id}`} className="hover:text-sky-600">Client</Link>
            {' › '}
            <span>Project</span>
          </nav>
        </div>
        <Link href={`/clients/${params.id}/projects/${params.projectId}/edit`}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
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

      {/* Tabs placeholder */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {['Project Info', 'Submission Details', 'Reporting', 'Files'].map((tab, i) => (
            <button key={tab} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${i === 0 ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="p-6 text-center text-gray-500">
          <p className="font-medium">Connect your Supabase database to view project details.</p>
          <p className="text-sm mt-1">Configure your environment variables to enable data loading.</p>
        </div>
      </div>
    </div>
  )
}
