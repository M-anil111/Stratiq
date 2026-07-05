'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, Plus, Users, Building2, DollarSign } from 'lucide-react'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  hold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  on_hold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  onboarding: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  in_onboarding: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  prospect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-400',
  hold: 'bg-amber-400',
  on_hold: 'bg-amber-400',
  cancelled: 'bg-red-400',
  completed: 'bg-slate-400',
  onboarding: 'bg-violet-400',
  in_onboarding: 'bg-violet-400',
  prospect: 'bg-blue-400',
}

function initials(first: string, last: string) {
  return ((first[0] || '') + (last[0] || '')).toUpperCase() || '?'
}

function avatarColor(name: string) {
  const colors = ['bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']
  return colors[(name || '?').charCodeAt(0) % colors.length]
}

type Business = {
  id: string
  company_name: string
  display_name: string
  project_status: string
  mrr: number
}

type Contact = {
  contact_first_name: string
  contact_last_name: string
  businesses: Business[]
}

function SkeletonCard() {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="skeleton w-11 h-11 rounded-full shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="skeleton h-3.5 w-2/3 rounded" />
          <div className="skeleton h-3 w-1/3 rounded" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="skeleton h-10 rounded-xl" />
        <div className="skeleton h-10 rounded-xl" />
      </div>
    </div>
  )
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  const fetchContacts = useCallback((q: string) => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    fetch(`/api/contacts?${params}`)
      .then(r => { if (!r.ok) throw new Error('Failed to load contacts'); return r.json() })
      .then(d => { setContacts(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(e => { setError(e.message || 'Something went wrong'); setLoading(false) })
  }, [])

  useEffect(() => { fetchContacts('') }, [fetchContacts])

  const onSearch = (q: string) => {
    setSearch(q)
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => fetchContacts(q), 300)
  }

  const totalBusinesses = contacts.reduce((sum, c) => sum + c.businesses.length, 0)

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Contacts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading ? 'Loading…' : `${contacts.length} contact${contacts.length !== 1 ? 's' : ''} · ${totalBusinesses} business${totalBusinesses !== 1 ? 'es' : ''}`}
          </p>
        </div>
        <Link
          href="/clients/new"
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-sky-500/20"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search contacts…"
          className="w-full bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-slate-500 rounded-xl pl-9 pr-9 py-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition"
        />
        {search && (
          <button
            onClick={() => { setSearch(''); fetchContacts('') }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-base font-semibold text-white mb-1">Failed to load contacts</h2>
          <p className="text-slate-500 text-sm max-w-xs mb-4">{error}</p>
          <button
            onClick={() => fetchContacts(search)}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {!error && loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : !error && contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-slate-600" />
          </div>
          <h2 className="text-base font-semibold text-white mb-1">
            {search ? 'No contacts found' : 'No contacts yet'}
          </h2>
          <p className="text-slate-500 text-sm max-w-xs">
            {search ? `No results for "${search}". Try a different name.` : 'Add a client to create your first contact.'}
          </p>
          {!search && (
            <Link href="/clients/new" className="mt-4 text-sm text-sky-400 hover:text-sky-300 font-medium transition-colors">
              + Add your first client
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {contacts.map((contact, idx) => {
            const fullName = [contact.contact_first_name, contact.contact_last_name].filter(Boolean).join(' ')
            const color = avatarColor(fullName)
            const totalMrr = contact.businesses.reduce((s, b) => s + (b.mrr || 0), 0)
            return (
              <div
                key={`${fullName}-${idx}`}
                className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200 flex flex-col gap-4"
              >
                {/* Contact header */}
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-full ${color} flex items-center justify-center font-bold text-white text-sm shrink-0`}>
                    {initials(contact.contact_first_name, contact.contact_last_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{fullName || '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {contact.businesses.length} business{contact.businesses.length !== 1 ? 'es' : ''}
                    </p>
                  </div>
                  {totalMrr > 0 && (
                    <div className="flex items-center gap-1 text-emerald-400 shrink-0">
                      <DollarSign className="h-3 w-3" />
                      <span className="text-xs font-semibold">{totalMrr.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Business list */}
                <div className="flex flex-col gap-2">
                  {contact.businesses.map(biz => (
                    <Link
                      key={biz.id}
                      href={`/clients/${biz.id}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-200 group"
                    >
                      <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0 group-hover:text-sky-400 transition-colors" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200 group-hover:text-white truncate transition-colors">
                          {biz.display_name || biz.company_name}
                        </p>
                        {biz.project_status && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[biz.project_status] || 'bg-slate-500'}`} />
                            <span className={`text-[10px] capitalize px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[biz.project_status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                              {biz.project_status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        )}
                      </div>
                      {biz.mrr > 0 && (
                        <span className="text-[10px] text-sky-400 font-semibold shrink-0">${biz.mrr.toLocaleString()}/mo</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
