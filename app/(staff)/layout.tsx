import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { GlobalSearch } from '@/components/GlobalSearch'

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mesh">
      <Sidebar />
      <div className="lg:ml-20 pb-20 lg:pb-0 min-h-screen flex flex-col">
        {/* Top header with search */}
        <header className="sticky top-0 z-20 flex items-center justify-end px-4 py-2 lg:px-6 glass-sidebar border-b border-white/[0.06]">
          <GlobalSearch />
        </header>
        <main className="flex-1">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
