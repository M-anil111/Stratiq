'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Share2, Send, CalendarClock, Image as ImageIcon, Link2, Megaphone,
  MessageSquare, CheckCircle2, AlertTriangle, Loader2, PlugZap,
  X, Check, FileText,
} from 'lucide-react'
import SocialCalendar from '@/components/SocialCalendar'
import SchedulePicker from '@/components/SchedulePicker'
import MediaUpload, { type MediaItem } from '@/components/MediaUpload'
import { SOCIAL_MEDIA_SPECS } from '@/lib/social-media-specs'

// NOTE: posts composed here are drafted / scheduled / stored and previewed only.
// Auto-publishing to each network activates once that platform's credentials are
// configured in Settings → Social Accounts.

type Account = { id: string; platform: string; account_name: string; account_handle: string | null; status: string }
type Client = { id: string; company_name: string }
type Project = { id: string; name?: string | null; domain?: string | null }
type ScheduledPost = {
  id: string; platform: string; post_content: string | null; media_url: string | null
  scheduled_date: string | null; live_link: string | null; comment: string | null
  status: string | null; project_name: string | null; client_name: string | null
  failed_reason?: string | null
}

const PLATFORM_META: Record<string, { label: string; color: string; limit: number }> = {
  facebook: { label: 'Facebook', color: '#1877F2', limit: 2500 },
  instagram: { label: 'Instagram', color: '#E4405F', limit: 2200 },
  linkedin: { label: 'LinkedIn', color: '#0A66C2', limit: 3000 },
  tiktok: { label: 'TikTok', color: '#000000', limit: 2200 },
  x: { label: 'X', color: '#1DA1F2', limit: 280 },
  youtube: { label: 'YouTube', color: '#FF0000', limit: 5000 },
}
function meta(platform: string) {
  return PLATFORM_META[platform?.toLowerCase()] || { label: platform || 'Unknown', color: '#64748b', limit: 5000 }
}

const inputClass = 'w-full bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 placeholder:text-slate-500'
const labelClass = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5'

// Brand colors for the small platform badge overlaid on avatar chips.
const BADGE_META: Record<string, { color: string; short: string }> = {
  facebook: { color: '#1877F2', short: 'f' },
  instagram: { color: '#E4405F', short: 'IG' },
  linkedin: { color: '#0A66C2', short: 'in' },
  x: { color: '#000000', short: 'X' },
  tiktok: { color: '#000000', short: 'TT' },
  youtube: { color: '#FF0000', short: 'YT' },
}
function badgeMeta(platform: string) {
  return BADGE_META[platform?.toLowerCase()] || { color: '#64748b', short: (platform || '?').slice(0, 2) }
}
function initials(name: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function AccountChip({ account, selected, onToggle }: { account: Account; selected: boolean; onToggle: () => void }) {
  const p = account.platform.toLowerCase()
  const m = meta(p)
  const b = badgeMeta(p)
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`${account.account_name}${account.account_handle ? ' · ' + account.account_handle : ''}`}
      aria-pressed={selected}
      className="flex flex-col items-center gap-1.5 w-[72px] shrink-0 group"
    >
      <span className="relative">
        <span
          className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-sm font-bold transition-all ${selected ? 'ring-2 ring-offset-2 ring-offset-[#0b1220]' : 'opacity-50 grayscale group-hover:opacity-80 group-hover:grayscale-0'}`}
          style={{ backgroundColor: m.color, ...(selected ? { ['--tw-ring-color' as any]: m.color } : {}) }}
        >
          {initials(account.account_name)}
        </span>
        <span
          className="absolute -bottom-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-[#0b1220]"
          style={{ backgroundColor: b.color }}
        >
          {b.short}
        </span>
        {selected && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-500 border-2 border-[#0b1220] flex items-center justify-center">
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className={`text-[11px] leading-tight text-center truncate w-full ${selected ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>{account.account_name}</span>
    </button>
  )
}

function PlatformBadge({ platform }: { platform: string }) {
  const m = meta(platform)
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold text-white"
      style={{ backgroundColor: m.color }}
    >
      {m.label}
    </span>
  )
}

export default function SocialPage() {
  const [tab, setTab] = useState<'compose' | 'calendar' | 'scheduled' | 'approvals'>('compose')
  const [showReview, setShowReview] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)

  // data
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [accountsUnavailable, setAccountsUnavailable] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [savedTimes, setSavedTimes] = useState<Record<string, string[]>>({})

  // composer state
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]) // account ids
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [contentType, setContentType] = useState<'post' | 'story' | 'reel'>('post')
  const [caption, setCaption] = useState('')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [showMediaReqs, setShowMediaReqs] = useState(false)
  const [link, setLink] = useState('')
  const [campaign, setCampaign] = useState('')
  const [firstComment, setFirstComment] = useState('')
  const [perNetwork, setPerNetwork] = useState<Record<string, { caption?: string; first_comment?: string }>>({})
  const [activeNetworkTab, setActiveNetworkTab] = useState<string>('')
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
  const [datetime, setDatetime] = useState('')
  const [createAnother, setCreateAnother] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null)
  const [error, setError] = useState('')

  // scheduled list
  const [posts, setPosts] = useState<ScheduledPost[] | null>(null)
  const [postsUnavailable, setPostsUnavailable] = useState(false)

  useEffect(() => {
    fetch('/api/social-accounts').then(r => r.json()).then((d) => {
      if (d?.__unavailable) { setAccountsUnavailable(true); setAccounts([]); return }
      setAccounts(Array.isArray(d) ? d : [])
    }).catch(() => setAccounts([]))

    fetch('/api/clients').then(r => r.json()).then((d) => {
      setClients(d?.clients || (Array.isArray(d) ? d : []))
    }).catch(() => {})

    fetch('/api/settings/social-schedule').then(r => r.json()).then((d) => {
      setSavedTimes(d?.schedule?.times || {})
    }).catch(() => {})
  }, [])

  // Load projects when client changes.
  useEffect(() => {
    if (!clientId) { setProjects([]); setProjectId(''); return }
    fetch(`/api/projects?client_id=${encodeURIComponent(clientId)}`).then(r => r.json()).then((d) => {
      const list: Project[] = d?.projects || (Array.isArray(d) ? d : [])
      setProjects(list)
    }).catch(() => setProjects([]))
    setProjectId('')
  }, [clientId])

  function loadScheduled() {
    setPosts(null)
    setPostsUnavailable(false)
    fetch('/api/social/scheduled').then(r => r.json()).then((d) => {
      if (d?.__unavailable) { setPostsUnavailable(true); setPosts([]); return }
      setPosts(Array.isArray(d?.posts) ? d.posts : [])
    }).catch(() => setPosts([]))
  }

  useEffect(() => { if ((tab === 'scheduled' || tab === 'approvals') && posts === null) loadScheduled() }, [tab]) // eslint-disable-line

  // Approve / reject / retry a post via PATCH /api/social/[id].
  async function actionPost(id: string, action: 'approve' | 'reject' | 'retry') {
    setActioningId(id)
    try {
      const res = await fetch(`/api/social/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        loadScheduled()
      }
    } catch {
      /* noop */
    } finally {
      setActioningId(null)
    }
  }

  const pendingPosts = useMemo(() => (posts || []).filter(p => p.status === 'pending_approval'), [posts])
  const failedPosts = useMemo(() => (posts || []).filter(p => p.status === 'failed'), [posts])

  // Selected platforms derived from selected accounts.
  const selectedPlatforms = useMemo(() => {
    const set = new Set<string>()
    for (const id of selectedAccounts) {
      const a = accounts?.find(x => x.id === id)
      if (a) set.add(a.platform.toLowerCase())
    }
    return Array.from(set)
  }, [selectedAccounts, accounts])

  // Primary media URL kept for the existing compose payload so nothing downstream
  // breaks; additional media items are still previewed.
  const primaryMediaUrl = media[0]?.url || ''

  // Keep the active per-network tab valid.
  useEffect(() => {
    if (selectedPlatforms.length && !selectedPlatforms.includes(activeNetworkTab)) {
      setActiveNetworkTab(selectedPlatforms[0])
    }
  }, [selectedPlatforms]) // eslint-disable-line

  function toggleAccount(id: string) {
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const allAccountIds = useMemo(() => (accounts || []).map(a => a.id), [accounts])
  const allSelected = allAccountIds.length > 0 && selectedAccounts.length === allAccountIds.length
  function toggleAll() {
    setSelectedAccounts(allSelected ? [] : allAccountIds)
  }

  // Validate and open the "Review & Schedule" gate before actually composing.
  function openReview() {
    setError('')
    setResult(null)
    if (selectedAccounts.length === 0) { setError('Select at least one connected account.'); return }
    if (!projectId) { setError('Pick the client and project these posts belong to.'); return }
    if (!caption.trim()) { setError('Write a caption.'); return }
    if (scheduleMode === 'later' && !datetime) { setError('Choose a date and time to schedule.'); return }
    setShowReview(true)
  }

  const reviewWhen = scheduleMode === 'later' && datetime
    ? `Post on ${new Date(datetime).toLocaleString()}`
    : 'Publish now'

  // Clear only the message content (used by "Create another").
  function clearContent() {
    setCaption(''); setMedia([]); setLink(''); setFirstComment('')
    setPerNetwork({})
  }
  // Full reset back to a blank composer.
  function resetComposer() {
    clearContent()
    setCampaign(''); setDatetime(''); setScheduleMode('now')
  }

  // Shared compose call. `draft` forces the API's now-branch (yields draft status).
  async function compose(draft: boolean) {
    setError('')
    setResult(null)
    const chosen = (accounts || []).filter(a => selectedAccounts.includes(a.id))
    const useLater = !draft && scheduleMode === 'later'
    const busy = draft ? setSavingDraft : setSubmitting
    busy(true)
    try {
      const res = await fetch('/api/social/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          accounts: chosen.map(a => ({ platform: a.platform, account_name: a.account_name })),
          content_type: contentType,
          caption,
          per_network: perNetwork,
          media_url: primaryMediaUrl || undefined,
          link: link || undefined,
          campaign: campaign || undefined,
          first_comment: firstComment || undefined,
          draft,
          schedule: { mode: useLater ? 'later' : 'now', datetime: useLater ? datetime : undefined },
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.error || 'Failed to compose posts.'); return }
      setShowReview(false)
      setResult({ created: data.created || 0, skipped: data.skipped || 0 })
      if (createAnother) clearContent()
      else resetComposer()
      setPosts(null) // force refresh of scheduled list next time
    } catch {
      setError('Network error. Please try again.')
    } finally {
      busy(false)
    }
  }
  const submit = () => compose(false)
  const saveDraft = () => compose(true)

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto">
      <div className="mb-6 flex items-start gap-3">
        <div className="p-2.5 bg-sky-500/10 rounded-xl text-sky-400 shrink-0">
          <Share2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Social</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Compose, schedule and preview posts across your connected networks.</p>
        </div>
      </div>

      {/* Honest capability note */}
      <div className="glass-card p-3 mb-6 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 border border-amber-500/20">
        <PlugZap className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <p>Posts are drafted, scheduled, stored and previewed here. Auto-publishing to each network turns on once that platform&apos;s credentials are configured in <Link href="/settings/social-accounts" className="text-sky-400 hover:underline">Settings → Social Accounts</Link>.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900/[0.04] dark:bg-white/[0.04] p-1 rounded-xl w-fit">
        {([['compose', 'Create post'], ['calendar', 'Calendar'], ['scheduled', 'Scheduled posts'], ['approvals', 'Approvals']] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === k ? 'bg-sky-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'calendar' ? (
        <SocialCalendar />
      ) : tab === 'compose' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* ---- Composer ---- */}
          <div className="space-y-5 min-w-0">
            {/* Accounts */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900 dark:text-white">Accounts</h2>
                {accounts && accounts.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    {allSelected ? 'Clear all' : 'Select all'}
                  </button>
                )}
              </div>
              {accounts === null ? (
                <div className="h-16 rounded-lg bg-slate-900/[0.04] dark:bg-white/[0.04] animate-pulse" />
              ) : accountsUnavailable || accounts.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  No connected accounts yet.{' '}
                  <Link href="/settings/social-accounts" className="text-sky-400 hover:underline">Connect one in Settings → Social Accounts</Link>.
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {(accounts || []).map(a => (
                    <AccountChip
                      key={a.id}
                      account={a}
                      selected={selectedAccounts.includes(a.id)}
                      onToggle={() => toggleAccount(a.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Destination + content type */}
            <div className="glass-card p-5 space-y-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">Post details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Client</label>
                  <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputClass}>
                    <option value="">Select client…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Project</label>
                  <select value={projectId} onChange={e => setProjectId(e.target.value)} disabled={!clientId} className={inputClass}>
                    <option value="">{clientId ? 'Select project…' : 'Pick a client first'}</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name || p.domain || p.id}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Content type</label>
                <div className="flex gap-1 bg-slate-900/[0.04] dark:bg-white/[0.04] p-1 rounded-xl w-fit">
                  {(['post', 'story', 'reel'] as const).map(t => (
                    <button key={t} onClick={() => setContentType(t)} className={`px-4 py-1.5 rounded-lg text-sm capitalize transition-colors ${contentType === t ? 'bg-sky-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>{t}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Caption */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900 dark:text-white">Caption</h2>
              </div>
              <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={5} placeholder="Write your post…" className={inputClass} />
              {selectedPlatforms.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedPlatforms.map(p => {
                    const m = meta(p)
                    const used = (perNetwork[p]?.caption?.trim() || caption).length
                    const over = used > m.limit
                    return (
                      <span key={p} className={`text-[11px] px-2 py-0.5 rounded-md ${over ? 'bg-red-500/15 text-red-400' : 'bg-slate-900/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-400'}`}>
                        {m.label}: {used}/{m.limit}
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Media */}
              <div className="pt-1">
                <label className={labelClass}><ImageIcon className="inline h-3.5 w-3.5 mr-1" />Media</label>
                <MediaUpload
                  platforms={selectedPlatforms}
                  clientId={clientId}
                  media={media}
                  onChange={setMedia}
                />
                {selectedPlatforms.length > 0 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setShowMediaReqs(v => !v)}
                      className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      {showMediaReqs ? 'Hide' : 'Show'} media requirements
                    </button>
                    {showMediaReqs && (
                      <div className="mt-2 space-y-2">
                        {selectedPlatforms.map(p => {
                          const spec = SOCIAL_MEDIA_SPECS[p]
                          if (!spec) return null
                          return (
                            <div key={p} className="rounded-lg border border-slate-900/10 dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.02] p-2.5 text-[11px] text-slate-600 dark:text-slate-400">
                              <div className="text-slate-800 dark:text-slate-200 font-medium mb-1">{spec.label}</div>
                              <div>Images: up to {spec.image.maxImagesPerPost}/post, ≤{spec.image.maxFileSizeMB}MB, aspect {spec.image.aspectRatioMin}–{spec.image.aspectRatioMax}{spec.image.gifSupport ? ', GIF ok' : ', no GIF'}</div>
                              <div>Video: ≤{spec.video.maxFileSizeMB}MB, {spec.video.minLenSec}–{spec.video.maxLenSec}s, aspect {spec.video.aspectRatioMin}–{spec.video.aspectRatioMax}, {spec.video.fileTypes.join('/')}</div>
                            </div>
                          )
                        })}
                        <p className="text-[11px] text-slate-500">Requirements are advisory — they warn but don&apos;t block. Video is validated only, never transcoded.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className={labelClass}><Link2 className="inline h-3.5 w-3.5 mr-1" />Link (optional)</label>
                  <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}><Megaphone className="inline h-3.5 w-3.5 mr-1" />Campaign (optional)</label>
                  <input value={campaign} onChange={e => setCampaign(e.target.value)} placeholder="Campaign name" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}><MessageSquare className="inline h-3.5 w-3.5 mr-1" />First comment (optional)</label>
                  <input value={firstComment} onChange={e => setFirstComment(e.target.value)} placeholder="Auto first comment" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Per-network customization */}
            {selectedPlatforms.length > 0 && (
              <div className="glass-card p-5 space-y-3">
                <h2 className="font-semibold text-slate-900 dark:text-white">Customize per network <span className="text-xs font-normal text-slate-500">(optional)</span></h2>
                <div className="flex flex-wrap gap-1">
                  {selectedPlatforms.map(p => (
                    <button key={p} onClick={() => setActiveNetworkTab(p)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${activeNetworkTab === p ? 'bg-sky-500 text-white' : 'bg-slate-900/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>{meta(p).label}</button>
                  ))}
                </div>
                {activeNetworkTab && (
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Override caption</label>
                      <textarea
                        value={perNetwork[activeNetworkTab]?.caption ?? ''}
                        onChange={e => setPerNetwork(prev => ({ ...prev, [activeNetworkTab]: { ...prev[activeNetworkTab], caption: e.target.value } }))}
                        rows={3} placeholder="Leave blank to use the base caption" className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Override first comment</label>
                      <input
                        value={perNetwork[activeNetworkTab]?.first_comment ?? ''}
                        onChange={e => setPerNetwork(prev => ({ ...prev, [activeNetworkTab]: { ...prev[activeNetworkTab], first_comment: e.target.value } }))}
                        placeholder="Leave blank to use the base first comment" className={inputClass}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Schedule */}
            <div className="glass-card p-5 space-y-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">Schedule</h2>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="radio" checked={scheduleMode === 'now'} onChange={() => setScheduleMode('now')} className="accent-sky-500" />
                  <Send className="h-4 w-4" /> Publish now
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="radio" checked={scheduleMode === 'later'} onChange={() => setScheduleMode('later')} className="accent-sky-500" />
                  <CalendarClock className="h-4 w-4" /> Schedule for later
                </label>
              </div>
              {scheduleMode === 'later' && (
                <SchedulePicker value={datetime} onChange={setDatetime} savedTimes={savedTimes} />
              )}
            </div>

            {/* Submit */}
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={openReview} disabled={submitting || savingDraft} className="btn-brand inline-flex items-center gap-2 disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {scheduleMode === 'later' ? 'Review & schedule' : 'Review & publish'}
              </button>
              <button onClick={saveDraft} disabled={submitting || savingDraft} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-900/[0.04] dark:bg-white/[0.06] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.12] transition-colors disabled:opacity-50">
                {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Save draft
              </button>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input type="checkbox" checked={createAnother} onChange={e => setCreateAnother(e.target.checked)} className="accent-sky-500" />
                Create another
              </label>
              {error && <span className="text-sm text-red-400 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> {error}</span>}
              {result && (
                <span className="text-sm text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> {result.created} post{result.created !== 1 ? 's' : ''} saved{result.skipped ? `, ${result.skipped} skipped` : ''}.
                </span>
              )}
            </div>
          </div>

          {/* ---- Live preview ---- */}
          <div className="space-y-4 min-w-0">
            <h2 className="font-semibold text-slate-900 dark:text-white">Live preview</h2>
            {selectedPlatforms.length === 0 ? (
              <div className="glass-card p-6 text-sm text-slate-500 text-center">Select accounts to preview your post.</div>
            ) : (
              selectedPlatforms.map(p => {
                const m = meta(p)
                const acct = (accounts || []).find(a => a.platform.toLowerCase() === p)
                const text = perNetwork[p]?.caption?.trim() || caption
                return (
                  <div key={p} className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: m.color }}>
                        {(acct?.account_name || m.label).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-slate-900 dark:text-white truncate">{acct?.account_name || m.label}</div>
                        <div className="text-xs text-slate-500 truncate">{acct?.account_handle || m.label}</div>
                      </div>
                      <div className="ml-auto"><PlatformBadge platform={p} /></div>
                    </div>
                    <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">{text || <span className="text-slate-500">Your caption will appear here…</span>}</p>
                    {primaryMediaUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={primaryMediaUrl} alt="media preview" className="mt-3 rounded-lg w-full max-h-56 object-cover border border-slate-900/10 dark:border-white/[0.08]" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    )}
                    {link && <div className="mt-2 text-xs text-sky-400 truncate flex items-center gap-1"><Link2 className="h-3 w-3" /> {link}</div>}
                    {firstComment && <div className="mt-2 text-xs text-slate-500 border-t border-slate-900/10 dark:border-white/[0.06] pt-2">First comment: {firstComment}</div>}
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : tab === 'scheduled' ? (
        /* ---- Scheduled posts ---- */
        <div>
          {posts === null ? (
            <div className="space-y-3">
              {[0, 1, 2].map(i => <div key={i} className="glass-card h-20 animate-pulse" />)}
            </div>
          ) : postsUnavailable ? (
            <div className="glass-card p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              Scheduled posts are unavailable. Apply the latest database migrations to enable this view.
            </div>
          ) : posts.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              No scheduled or recent posts yet. Create one from the Create post tab.
            </div>
          ) : (
            <div className="space-y-2.5">
              {posts.map(p => (
                <div key={p.id} className="glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <PlatformBadge platform={p.platform} />
                    {p.status && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-md ${p.status === 'scheduled' ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300' : p.status === 'live' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-900/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-400'}`}>{p.status}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-900 dark:text-white truncate">{p.post_content || <span className="text-slate-500">No caption</span>}</p>
                    <p className="text-xs text-slate-500 truncate">{p.client_name || 'Unknown client'}{p.project_name ? ` · ${p.project_name}` : ''}</p>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 shrink-0">
                    {p.scheduled_date ? new Date(p.scheduled_date).toLocaleString() : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ---- Approvals ---- */
        <div className="space-y-8">
          {posts === null ? (
            <div className="space-y-3">
              {[0, 1, 2].map(i => <div key={i} className="glass-card h-20 animate-pulse" />)}
            </div>
          ) : postsUnavailable ? (
            <div className="glass-card p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              Approvals are unavailable. Apply the latest database migrations to enable this view.
            </div>
          ) : (
            <>
              {/* Pending approval */}
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-400" /> Pending approval
                  {pendingPosts.length > 0 && <span className="text-xs text-slate-500">({pendingPosts.length})</span>}
                </h2>
                {pendingPosts.length === 0 ? (
                  <div className="glass-card p-6 text-center text-sm text-slate-600 dark:text-slate-400">No posts awaiting approval.</div>
                ) : (
                  <div className="space-y-2.5">
                    {pendingPosts.map(p => (
                      <div key={p.id} className="glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-2 shrink-0"><PlatformBadge platform={p.platform} /></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-900 dark:text-white truncate">{p.post_content || <span className="text-slate-500">No caption</span>}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {p.client_name || 'Unknown client'}{p.project_name ? ` · ${p.project_name}` : ''}
                            {p.scheduled_date ? ` · ${new Date(p.scheduled_date).toLocaleString()}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => actionPost(p.id, 'approve')}
                            disabled={actioningId === p.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                          >
                            {actioningId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Approve
                          </button>
                          <button
                            onClick={() => actionPost(p.id, 'reject')}
                            disabled={actioningId === p.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-700 dark:text-red-300 bg-red-500/15 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Failed posts */}
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" /> Failed posts
                  {failedPosts.length > 0 && <span className="text-xs text-slate-500">({failedPosts.length})</span>}
                </h2>
                {failedPosts.length === 0 ? (
                  <div className="glass-card p-6 text-center text-sm text-slate-600 dark:text-slate-400">No failed posts.</div>
                ) : (
                  <div className="space-y-2.5">
                    {failedPosts.map(p => (
                      <div key={p.id} className="glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 border border-red-500/20">
                        <div className="flex items-center gap-2 shrink-0"><PlatformBadge platform={p.platform} /></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-900 dark:text-white truncate">{p.post_content || <span className="text-slate-500">No caption</span>}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {p.client_name || 'Unknown client'}{p.project_name ? ` · ${p.project_name}` : ''}
                          </p>
                          {p.failed_reason && (
                            <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" /> {p.failed_reason}</p>
                          )}
                        </div>
                        <button
                          onClick={() => actionPost(p.id, 'retry')}
                          disabled={actioningId === p.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-500/15 hover:bg-sky-500/25 transition-colors disabled:opacity-50 shrink-0"
                        >
                          {actioningId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                          Retry
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Review & Schedule modal */}
      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !submitting && setShowReview(false)}>
          <div className="glass-card w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Review &amp; {scheduleMode === 'later' ? 'Schedule' : 'Publish'}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                  {scheduleMode === 'later' ? <CalendarClock className="h-4 w-4" /> : <Send className="h-4 w-4" />} {reviewWhen}
                </p>
              </div>
              <button onClick={() => !submitting && setShowReview(false)} aria-label="Close" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            {campaign && (
              <div className="mb-4 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Campaign: <span className="text-slate-800 dark:text-slate-200">{campaign}</span></div>
            )}

            <div className="space-y-3">
              {(accounts || []).filter(a => selectedAccounts.includes(a.id)).map(a => {
                const p = a.platform.toLowerCase()
                const m = meta(p)
                const text = perNetwork[p]?.caption?.trim() || caption
                return (
                  <div key={a.id} className="rounded-xl border border-slate-900/10 dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.02] p-4 flex gap-3">
                    {primaryMediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={primaryMediaUrl} alt="media" className="w-16 h-16 rounded-lg object-cover border border-slate-900/10 dark:border-white/[0.08] shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-900/10 dark:border-white/[0.08] shrink-0 flex items-center justify-center text-slate-600"><ImageIcon className="h-5 w-5" /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <PlatformBadge platform={p} />
                        <span className="text-sm text-slate-900 dark:text-white truncate">{a.account_name}</span>
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words line-clamp-4">{text}</p>
                      {(perNetwork[p]?.first_comment?.trim() || firstComment) && (
                        <p className="text-xs text-slate-500 mt-1.5 truncate">First comment: {perNetwork[p]?.first_comment?.trim() || firstComment}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {error && <p className="text-sm text-red-400 flex items-center gap-1 mt-4"><AlertTriangle className="h-4 w-4" /> {error}</p>}

            <div className="flex flex-wrap items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowReview(false)} disabled={submitting} className="px-4 py-2 rounded-xl text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-900/[0.04] dark:bg-white/[0.06] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.12] transition-colors disabled:opacity-50">Back</button>
              <button onClick={submit} disabled={submitting} className="btn-brand inline-flex items-center gap-2 disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {scheduleMode === 'later' ? 'Schedule' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
