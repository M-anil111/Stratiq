import Link from 'next/link'
import { ChevronLeft, Edit, Plus, MessageSquare, Building2, Globe, Mail, Phone, MapPin, Users, Calendar } from 'lucide-react'
import { notFound } from 'next/navigation'

// Temporary placeholder — will be replaced with real data fetch
function daysAgo(date: string | null): string {
  if (!date) return 'Unknown'
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

function websiteUpdateColor(date: string | null): string {
  if (!date) return 'text-gray-500'
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (days < 30) return 'text-green-600'
  if (days < 90) return 'text-amber-600'
  return 'text-red-600'
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  on_hold: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-800',
  prospect: 'bg-blue-100 text-blue-800',
  in_onboarding: 'bg-purple-100 text-purple-800',
}

const statusLabels: Record<string, string> = {
  active: 'Active', on_hold: 'On Hold', cancelled: 'Cancelled',
  completed: 'Completed', prospect: 'Prospect', in_onboarding: 'In Onboarding',
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  // In production this would fetch from the database
  // For now, show a placeholder skeleton state
  const client = null as any // TODO: fetch from DB

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clients" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 truncate">Client Details</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">Loading...</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">ID: {params.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/clients/${params.id}/edit`} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            <Edit className="h-4 w-4" />
            <span className="hidden sm:inline">Edit</span>
          </Link>
          <Link href={`/clients/${params.id}/projects/new`} className="flex items-center gap-2 px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Project</span>
          </Link>
        </div>
      </div>

      {/* Placeholder content */}
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="font-medium">Connect your Supabase database to view client details.</p>
        <p className="text-sm mt-2">Add your environment variables to .env.local to enable data loading.</p>
      </div>
    </div>
  )
}
