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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-gray-900">Stratiq</span>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <Link key={item.href} href={item.href} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors">
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <button className="text-sm text-red-600 hover:text-red-700">Sign Out</button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around px-2 py-1">
        {navItems.slice(0, 5).map(item => (
          <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-1 px-2 text-xs text-gray-500 hover:text-sky-600">
            <item.icon className="h-5 w-5" />
            <span className="leading-none">{item.label.split(' ')[0]}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
