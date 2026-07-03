import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      {/* Main content — offset for sidebar on desktop */}
      <div className="lg:ml-60 pb-20 lg:pb-0">
        {children}
      </div>
      <MobileNav />
    </div>
  )
}
