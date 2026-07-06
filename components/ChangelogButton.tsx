'use client'
import { useEffect, useState } from 'react'
import { Sparkles, Zap, Wrench, ShieldCheck } from 'lucide-react'
import { APP_VERSION, CHANGELOG, type ChangelogTag } from '@/lib/version'
import SlideOver from '@/components/SlideOver'

const TAG_STYLES: Record<ChangelogTag, { label: string; cls: string; Icon: any }> = {
  feature: { label: 'Feature', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20', Icon: Zap },
  fix: { label: 'Fix', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20', Icon: Wrench },
  security: { label: 'Security', cls: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20', Icon: ShieldCheck },
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

/**
 * "What's new" button showing the current version and an unseen-release dot.
 * Tracks the last seen version in localStorage (`changelog_seen_version`).
 * Opens the changelog in a right-side slide-over so the current page (and its
 * contextual sub-nav) is preserved — no navigation occurs.
 */
export default function ChangelogButton({ className = '' }: { className?: string }) {
  const [hasUnseen, setHasUnseen] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const seen = localStorage.getItem('changelog_seen_version')
      setHasUnseen(seen !== APP_VERSION)
    } catch {
      setHasUnseen(false)
    }
  }, [])

  const handleClick = () => {
    try {
      localStorage.setItem('changelog_seen_version', APP_VERSION)
    } catch {}
    setHasUnseen(false)
    setOpen(true)
  }

  return (
    <>
      <button
        onClick={handleClick}
        title="What's new"
        className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors ${className}`}
      >
        <Sparkles className="h-4 w-4 text-sky-400" />
        <span className="hidden sm:inline">What&apos;s new</span>
        <span className="text-xs text-slate-500">v{APP_VERSION}</span>
        {hasUnseen && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sky-400 ring-2 ring-slate-900" />
        )}
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-sky-400" />
            What&apos;s New
          </span>
        }
      >
        <div className="mb-6">
          <p className="text-slate-600 dark:text-slate-400 text-sm">The latest features, fixes, and improvements in Stratiq</p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Current version v{APP_VERSION}
          </div>
        </div>

        <div className="relative pl-6 border-l border-slate-900/10 dark:border-white/[0.1] space-y-8">
          {CHANGELOG.map((entry) => {
            const tag = TAG_STYLES[entry.tag]
            const isCurrent = entry.version === APP_VERSION
            return (
              <div key={entry.version} className="relative">
                <span className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${isCurrent ? 'bg-sky-400' : 'bg-slate-400 dark:bg-slate-600'}`} />
                <div className="glass-card p-5">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">v{entry.version}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${tag.cls}`}>
                      <tag.Icon className="h-3 w-3" />
                      {tag.label}
                    </span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-900/[0.06] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">Current</span>
                    )}
                    <span className="text-xs text-slate-500 ml-auto">{formatDate(entry.date)}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">{entry.title}</p>
                  <ul className="space-y-1.5">
                    {entry.changes.map((c, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <span className="text-sky-400/60 mt-0.5">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      </SlideOver>
    </>
  )
}
