import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mesh">
      <Sidebar />
      <div className="lg:ml-60 pb-20 lg:pb-0 min-h-screen">
        {children}
      </div>
      <MobileNav />
    </div>
  )
}
