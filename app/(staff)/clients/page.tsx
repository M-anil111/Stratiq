import Link from 'next/link'
import { Plus, Search, Filter, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function ClientsPage() {
  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-slate-400 text-sm">Manage your client portfolio</p>
        </div>
        <Link
          href="/clients/new"
          className="btn-brand flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Client</span>
        </Link>
      </div>

      {/* Search + Filter bar */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search clients by name, domain, city..."
            className="input-glass w-full pl-10 pr-4 py-2.5"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 border border-white/[0.08] rounded-lg text-sm text-slate-300 bg-white/[0.05] hover:bg-white/[0.08] transition-colors">
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filter</span>
        </button>
      </div>

      {/* Empty state */}
      <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-white/[0.05] rounded-full flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No clients yet</h3>
        <p className="text-slate-400 text-sm mb-6 max-w-sm">Add your first client to get started. You can track projects, activities, and reports for each client.</p>
        <Link href="/clients/new" className="btn-brand px-6 py-2.5 font-medium rounded-lg transition-colors">
          Add Your First Client
        </Link>
      </div>
    </div>
  )
}
