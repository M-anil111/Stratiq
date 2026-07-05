'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, FolderOpen, BarChart3, Files, MessageSquare, ShoppingBag, User, LogOut, Menu, X } from 'lucide-react'

const navItems = [
  { href: '/portal', label: 'Dashboard', icon: Home, exact: true },
  { href: '/portal/projects', label: 'Projects', icon: FolderOpen },
  { href: '/portal/reports', label: 'Reports', icon: BarChart3 },
  { href: '/portal/files', label: 'Files', icon: Files },
  { href: '/portal/messages', label: 'Messages', icon: MessageSquare },
  { href: '/portal/upgrade', label: 'Upgrade', icon: ShoppingBag },
  { href: '/portal/account', label: 'Account', icon: User },
]

interface AccountData {
  full_name: string
  email: string
}

interface BrandingData {
  company_name: string
  logo_url: string | null
  brand_color: string | null
}

const DEFAULT_BRANDING: BrandingData = { company_name: 'Stratiq', logo_url: null, brand_color: null }

function BrandMark({ branding, textClass = 'text-lg' }: { branding: BrandingData; textClass?: string }) {
  return (
    <span className="flex items-center gap-2.5 min-w-0">
      {branding.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.logo_url}
          alt={`${branding.company_name} logo`}
          className="h-8 w-auto rounded object-contain flex-shrink-0"
        />
      )}
      <span className={`font-bold text-white truncate ${textClass}`}>{branding.company_name}</span>
    </span>
  )
}

interface NavLinksProps {
  pathname: string
  unreadCount: number
  onLinkClick?: () => void
  onLogout: () => void
  account: AccountData | null
  brandColor: string | null
}

function NavLinks({ pathname, unreadCount, onLinkClick, onLogout, account, brandColor }: NavLinksProps) {
  function isActive(item: typeof navItems[0]) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  return (
    <>
      {/* User info */}
      <div className="px-4 py-4 border-b border-white/[0.06]">
        <p className="text-sm font-semibold text-white truncate">{account?.full_name || ' '}</p>
        <p className="text-xs text-slate-500 truncate mt-0.5">{account?.email || ' '}</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                active
                  ? brandColor
                    ? 'font-medium'
                    : 'bg-sky-500/15 text-sky-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
              style={
                active && brandColor
                  ? { color: 'var(--brand)', backgroundColor: 'color-mix(in srgb, var(--brand) 15%, transparent)' }
                  : undefined
              }
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.href === '/portal/messages' && unreadCount > 0 && (
                <span
                  className={`text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none ${brandColor ? '' : 'bg-sky-500'}`}
                  style={brandColor ? { backgroundColor: 'var(--brand)' } : undefined}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all w-full"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [account, setAccount] = useState<AccountData | null>(null)
  const [branding, setBranding] = useState<BrandingData>(DEFAULT_BRANDING)
  const [unreadCount, setUnreadCount] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    fetch('/api/portal/account')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAccount(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/portal/branding')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.company_name) {
          setBranding({
            company_name: data.company_name,
            logo_url: data.logo_url || null,
            brand_color: data.brand_color || null,
          })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/portal/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUnreadCount(data.unread_messages ?? 0) })
      .catch(() => {})
  }, [])

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  function isActive(item: typeof navItems[0]) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  const brandColor = branding.brand_color
  const sidebarBg = { background: 'rgba(6,10,18,0.96)', backdropFilter: 'blur(36px)' }

  return (
    <div
      className="min-h-screen bg-mesh flex"
      style={brandColor ? ({ ['--brand' as string]: brandColor } as React.CSSProperties) : undefined}
    >
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex md:flex-col w-56 lg:w-60 shrink-0 border-r border-white/[0.08] sticky top-0 h-screen z-10"
        style={sidebarBg}
      >
        {/* Logo */}
        <div className="px-5 h-14 flex items-center border-b border-white/[0.06]">
          <BrandMark branding={branding} />
        </div>
        <NavLinks
          pathname={pathname}
          unreadCount={unreadCount}
          onLogout={handleLogout}
          account={account}
          brandColor={brandColor}
        />
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer */}
          <aside
            className="absolute left-0 top-0 bottom-0 w-64 flex flex-col border-r border-white/[0.08] z-50"
            style={{ background: 'rgba(6,10,18,0.99)' }}
          >
            {/* Drawer header */}
            <div className="px-5 h-14 flex items-center justify-between border-b border-white/[0.06]">
              <BrandMark branding={branding} />
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-slate-400 hover:text-white transition-colors p-1 -mr-1"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks
              pathname={pathname}
              unreadCount={unreadCount}
              onLinkClick={() => setDrawerOpen(false)}
              onLogout={handleLogout}
              account={account}
              brandColor={brandColor}
            />
          </aside>
        </div>
      )}

      {/* Right side: top bar (mobile only) + content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header
          className="md:hidden sticky top-0 z-20 border-b border-white/[0.08] flex items-center px-4 h-14"
          style={{ background: 'rgba(6,10,18,0.88)', backdropFilter: 'blur(36px)' }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-slate-400 hover:text-white transition-colors p-1 -ml-1 mr-3"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <BrandMark branding={branding} textClass="text-base" />
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-6 pb-24 md:pb-6 max-w-5xl w-full mx-auto">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 border-t border-white/[0.08] flex items-center justify-around px-2 py-1"
          style={{ background: 'rgba(6,10,18,0.88)', backdropFilter: 'blur(28px)' }}
        >
          {navItems.slice(0, 5).map(item => {
            const active = isActive(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center gap-0.5 py-1 px-2 text-xs transition-colors ${
                  active
                    ? brandColor ? '' : 'text-sky-400'
                    : 'text-slate-400 hover:text-white'
                }`}
                style={active && brandColor ? { color: 'var(--brand)' } : undefined}
              >
                <item.icon className="h-5 w-5" />
                <span className="leading-none">{item.label}</span>
                {item.href === '/portal/messages' && unreadCount > 0 && (
                  <span
                    className={`absolute top-0 right-1 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 leading-none ${brandColor ? '' : 'bg-sky-500'}`}
                    style={brandColor ? { backgroundColor: 'var(--brand)' } : undefined}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
