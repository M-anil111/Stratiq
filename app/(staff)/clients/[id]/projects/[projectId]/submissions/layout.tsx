'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronLeft } from 'lucide-react'

const sections = [
  { label: 'Social Media', href: 'social-media' },
  { label: 'Off-Page', href: 'offpage' },
  { label: 'Blog', href: 'blog' },
  { label: 'OnPage', href: 'onpage' },
  { label: 'Group', href: 'group' },
]

export default function SubmissionsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string; projectId: string }
}) {
  const pathname = usePathname()
  const base = `/clients/${params.id}/projects/${params.projectId}/submissions`

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/clients/${params.id}/projects/${params.projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Submission Details</h1>
          <p className="text-sm text-gray-500">Log and track all marketing activities</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto mb-6 bg-white rounded-xl border border-gray-100 p-1">
        {sections.map(section => {
          const href = `${base}/${section.href}`
          const isActive = pathname.endsWith(`/${section.href}`)
          return (
            <Link
              key={section.href}
              href={href}
              className={cn(
                'flex-1 text-center px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
                isActive ? 'bg-sky-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {section.label}
            </Link>
          )
        })}
        <Link
          href={`/clients/${params.id}/projects/${params.projectId}/keywords`}
          className={cn(
            'flex-1 text-center px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
            'text-gray-600 hover:bg-gray-100'
          )}
        >
          Keywords
        </Link>
      </div>

      {children}
    </div>
  )
}
