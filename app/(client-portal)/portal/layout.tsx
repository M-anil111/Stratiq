import Link from 'next/link'
import { Home, FolderOpen, BarChart3, Files, MessageSquare, ShoppingBag, User } from 'lucide-react'

const navItems = [
  { href: '/portal', label: 'Home', icon: Home },
  { href: '/portal/projects', label: 'My Projects', icon: FolderOpen },
  { href: '/portal/reports', label: 'My Reports', icon: BarChart3 },
  { href: '/portal/files', label: 'Files', icon: Files },
  { href: '/portal/messages', label: 'Messages', icon: MessageSquare },
  { href: '/portal/upgrade', label: 'Upgrade Services', icon: ShoppingBag },
  { href: '/portal/account', label: 'My Account', icon: User },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mesh">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/[0.08]" style={{ background: 'rgba(6,10,18,0.88)', backdropFilter: 'blur(36px)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-white">Stratiq</span>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <Link key={item.href} href={item.href} className="flex items-center gap-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg px-3 py-1.5 text-sm transition-all">
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <button className="text-sm text-slate-400 hover:text-white transition-colors">Sign Out</button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-white/[0.08] flex items-center justify-around px-2 py-1" style={{ background: 'rgba(6,10,18,0.88)', backdropFilter: 'blur(28px)' }}>
        {navItems.slice(0, 5).map(item => (
          <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-1 px-2 text-xs text-slate-400 hover:text-white transition-colors">
            <item.icon className="h-5 w-5" />
            <span className="leading-none">{item.label.split(' ')[0]}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
