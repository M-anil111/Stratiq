'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Share2, Send, CalendarClock, Image as ImageIcon, Link2, Megaphone,
  MessageSquare, CheckCircle2, AlertTriangle, Loader2, PlugZap,
  X, Check, FileText, Sparkles, FolderOpen, Upload, Download, Video,
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

type LibraryAsset = {
  id: string; drive_file_id?: string | null; name: string; url: string
  mime_type?: string | null; kind: 'image' | 'video' | 'gif' | string
}
type BulkRow = {
  date: string; time: string; platforms: string[]; caption: string
  media_url?: string; link?: string
}

// Splits a single CSV line respecting double-quoted fields ("" escapes a quote).
function splitCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = false }
      } else { cur += ch }
    } else if (ch === '"') { inQuotes = true }
    else if (ch === ',') { out.push(cur); cur = '' }
    else { cur += ch }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

// Parses pasted CSV into scheduler rows plus human-readable warnings.
function parseBulkCSV(text: string): { rows: BulkRow[]; warnings: string[] } {
  const rows: BulkRow[] = []
  const warnings: string[] = []
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return { rows, warnings }
  let start = 0
  if (/date/i.test(lines[0]) && /caption/i.test(lines[0])) start = 1
  for (let i = start; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i])
    const date = (cols[0] || '').trim()
    const time = (cols[1] || '').trim()
    const platforms = (cols[2] || '').split(/[,;|]/).map(s => s.trim().toLowerCase()).filter(Boolean)
    const caption = (cols[3] || '').trim()
    const media_url = (cols[4] || '').trim()
    const link = (cols[5] || '').trim()
    const rowNo = i + 1
    if (!date || !caption) { warnings.push(`Row ${rowNo}: missing date or caption — skipped.`); continue }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) warnings.push(`Row ${rowNo}: date "${date}" is not YYYY-MM-DD.`)
    if (time && !/^\d{1,2}:\d{2}$/.test(time)) warnings.push(`Row ${rowNo}: time "${time}" is not HH:MM.`)
    if (platforms.length === 0) warnings.push(`Row ${rowNo}: no platforms listed.`)
    rows.push({
      date, time: time || '09:00', platforms, caption,
      media_url: media_url || undefined, link: link || undefined,
    })
  }
  return { rows, warnings }
}

const BULK_SAMPLE = 'data:text/csv;charset=utf-8,' + encodeURIComponent(
  'Date,Time,Platforms,Caption,Media URL,Link\n' +
  '2026-07-10,09:30,"instagram,facebook","Launch day is here! Meet the new collection.",https://example.com/img.jpg,https://example.com/shop\n' +
  '2026-07-11,14:00,linkedin,"Behind the scenes of this week\'s build.",,\n'
)

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

  // AI caption assist
  const [showAI, setShowAI] = useState(false)
  const [aiTopic, setAiTopic] = useState('')
  const [aiTone, setAiTone] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  // Media library picker
  const [showLibrary, setShowLibrary] = useState(false)
  const [libAssets, setLibAssets] = useState<LibraryAsset[] | null>(null)
  const [libSaved, setLibSaved] = useState<Set<string>>(new Set())

  // Bulk upload
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkResult, setBulkResult] = useState<{ created: number; errors: string[] } | null>(null)

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

  // ---- AI caption ----
  async function generateCaption() {
    setAiError('')
    if (!aiTopic.trim()) { setAiError('Tell me what this post is about.'); return }
    setAiLoading(true)
    try {
      const platform = selectedPlatforms[0] || 'instagram'
      const res = await fetch('/api/social/ai-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic,
          platform,
          tone: aiTone || undefined,
          existing: caption || undefined,
          want_hashtags: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 503) {
        setAiError(data?.error || 'AI captions aren’t configured yet (ANTHROPIC_API_KEY unset).')
        return
      }
      if (!res.ok) { setAiError(data?.error || 'Couldn’t generate a caption. Try again.'); return }
      const tags: string[] = Array.isArray(data?.hashtags) ? data.hashtags : []
      const tagStr = tags.map(t => (t.startsWith('#') ? t : `#${t}`)).join(' ')
      const next = [String(data?.caption || '').trim(), tagStr].filter(Boolean).join('\n\n')
      if (next) setCaption(next)
      setShowAI(false)
      setAiTopic('')
    } catch {
      setAiError('Network error. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  // ---- Media library ----
  function openLibrary() {
    setShowLibrary(true)
    setLibAssets(null)
    fetch('/api/media-library')
      .then(r => r.json())
      .then(d => setLibAssets(Array.isArray(d) ? d : []))
      .catch(() => setLibAssets([]))
  }
  function pickAsset(a: LibraryAsset) {
    const kind: MediaItem['kind'] = a.kind === 'video' ? 'video' : a.kind === 'gif' ? 'gif' : 'image'
    setMedia(prev => [...prev, { url: a.url, file_id: a.drive_file_id || undefined, kind, name: a.name }])
    setShowLibrary(false)
  }
  async function saveToLibrary(m: MediaItem) {
    const mime = m.kind === 'video' ? 'video/mp4' : m.kind === 'gif' ? 'image/gif' : 'image/jpeg'
    try {
      const res = await fetch('/api/media-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: m.url,
          name: m.name || m.url,
          mime_type: mime,
          kind: m.kind === 'gif' ? 'image' : m.kind,
          drive_file_id: m.file_id || undefined,
        }),
      })
      if (res.ok) setLibSaved(prev => new Set(prev).add(m.url))
    } catch {
      /* noop — non-blocking */
    }
  }

  // ---- Bulk upload ----
  const bulkParsed = useMemo(() => parseBulkCSV(bulkText), [bulkText])
  async function submitBulk() {
    setBulkError('')
    setBulkResult(null)
    if (!projectId) { setBulkError('Pick a client and project first.'); return }
    if (bulkParsed.rows.length === 0) { setBulkError('No valid rows to schedule.'); return }
    setBulkLoading(true)
    try {
      const res = await fetch('/api/social/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, rows: bulkParsed.rows }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setBulkError(data?.error || 'Bulk scheduling failed.'); return }
      setBulkResult({ created: data?.created || 0, errors: Array.isArray(data?.errors) ? data.errors : [] })
      setPosts(null)
      loadScheduled()
    } catch {
      setBulkError('Network error. Please try again.')
    } finally {
      setBulkLoading(false)
    }
  }

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
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex gap-1 bg-slate-900/[0.04] dark:bg-white/[0.04] p-1 rounded-xl w-fit">
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
        <button
          type="button"
          onClick={() => { setBulkError(''); setBulkResult(null); setShowBulk(true) }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-900/[0.04] dark:bg-white/[0.06] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.12] transition-colors"
        >
          <Upload className="h-4 w-4" /> Bulk upload
        </button>
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
                <button
                  type="button"
                  onClick={() => { setAiError(''); setShowAI(v => !v) }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-sky-600 dark:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" /> AI caption
                </button>
              </div>

              {showAI && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.06] p-3.5 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                    <Sparkles className="h-3.5 w-3.5 text-sky-500" /> Generate a caption
                    <button type="button" onClick={() => setShowAI(false)} aria-label="Close" className="ml-auto text-slate-500 hover:text-slate-900 dark:hover:text-white"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <div>
                    <label className={labelClass}>What&apos;s this post about?</label>
                    <textarea
                      value={aiTopic}
                      onChange={e => setAiTopic(e.target.value)}
                      rows={2}
                      placeholder="e.g. Summer sale on running shoes, 20% off this weekend"
                      className={inputClass}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className={labelClass}>Tone (optional)</label>
                      <select value={aiTone} onChange={e => setAiTone(e.target.value)} className={inputClass}>
                        <option value="">Default</option>
                        <option value="professional">Professional</option>
                        <option value="casual">Casual</option>
                        <option value="playful">Playful</option>
                        <option value="inspirational">Inspirational</option>
                        <option value="bold">Bold</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={generateCaption}
                      disabled={aiLoading}
                      className="btn-brand inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Generate
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">Uses your first selected platform ({selectedPlatforms[0] || 'instagram'}). Fills the caption and appends hashtags.</p>
                  {aiError && <div className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {aiError}</div>}
                </div>
              )}

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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400"><ImageIcon className="inline h-3.5 w-3.5 mr-1" />Media</label>
                  <button
                    type="button"
                    onClick={openLibrary}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-900/[0.04] dark:bg-white/[0.06] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.12] transition-colors"
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> Library
                  </button>
                </div>
                <MediaUpload
                  platforms={selectedPlatforms}
                  clientId={clientId}
                  media={media}
                  onChange={setMedia}
                  onSaveToLibrary={saveToLibrary}
                  savedUrls={libSaved}
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

      {/* Media library picker modal */}
      {showLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowLibrary(false)}>
          <div className="glass-card w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><FolderOpen className="h-5 w-5 text-sky-500" /> Media library</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Pick a saved asset to add to this post.</p>
              </div>
              <button onClick={() => setShowLibrary(false)} aria-label="Close" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            {libAssets === null ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map(i => <div key={i} className="aspect-square rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.04] animate-pulse" />)}
              </div>
            ) : libAssets.length === 0 ? (
              <div className="glass-card p-8 text-center text-sm text-slate-600 dark:text-slate-400">No saved media yet.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {libAssets.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => pickAsset(a)}
                    title={a.name}
                    className="group text-left rounded-xl overflow-hidden border border-slate-900/10 dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.02] hover:border-sky-500/50 transition-colors"
                  >
                    <div className="aspect-square bg-slate-900/[0.04] dark:bg-white/[0.04] flex items-center justify-center overflow-hidden">
                      {a.kind === 'video' ? (
                        <div className="flex flex-col items-center gap-1 text-slate-500"><Video className="h-6 w-6" /><span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900/[0.06] dark:bg-white/[0.08] max-w-[90%] truncate">{a.name}</span></div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.url} alt={a.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      )}
                    </div>
                    <div className="px-2 py-1.5 text-[11px] text-slate-600 dark:text-slate-400 truncate">{a.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk upload modal */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !bulkLoading && setShowBulk(false)}>
          <div className="glass-card w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Upload className="h-5 w-5 text-sky-500" /> Bulk upload</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Paste CSV to schedule many posts at once.</p>
              </div>
              <button onClick={() => !bulkLoading && setShowBulk(false)} aria-label="Close" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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

            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass + ' mb-0'}>CSV</label>
              <a href={BULK_SAMPLE} download="social-bulk-sample.csv" className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-300 hover:underline">
                <Download className="h-3.5 w-3.5" /> Sample CSV
              </a>
            </div>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              rows={8}
              placeholder="Date,Time,Platforms,Caption,Media URL,Link"
              className={inputClass + ' font-mono text-xs'}
            />
            <p className="text-[11px] text-slate-500 mt-1.5">Columns: Date (YYYY-MM-DD), Time (HH:MM 24h), Platforms (comma-separated), Caption, optional Media URL, optional Link. A header row is auto-detected.</p>

            {bulkText.trim() && (
              <div className="mt-3 space-y-2">
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {bulkParsed.rows.length} row{bulkParsed.rows.length !== 1 ? 's' : ''} ready to schedule.
                </div>
                {bulkParsed.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-2.5 space-y-0.5">
                    {bulkParsed.warnings.map((w, i) => (
                      <div key={i} className="text-[11px] text-amber-600 dark:text-amber-300 flex items-start gap-1.5"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {w}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {bulkResult && (
              <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
                <div className="text-sm text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> {bulkResult.created} post{bulkResult.created !== 1 ? 's' : ''} scheduled.</div>
                {bulkResult.errors.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {bulkResult.errors.map((e, i) => (
                      <div key={i} className="text-[11px] text-red-400 flex items-start gap-1.5"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {String(e)}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {bulkError && <p className="text-sm text-red-400 flex items-center gap-1 mt-3"><AlertTriangle className="h-4 w-4" /> {bulkError}</p>}

            <div className="flex flex-wrap items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowBulk(false)} disabled={bulkLoading} className="px-4 py-2 rounded-xl text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-900/[0.04] dark:bg-white/[0.06] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.12] transition-colors disabled:opacity-50">Close</button>
              <button onClick={submitBulk} disabled={bulkLoading || bulkParsed.rows.length === 0} className="btn-brand inline-flex items-center gap-2 disabled:opacity-50">
                {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Schedule {bulkParsed.rows.length || ''} post{bulkParsed.rows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
