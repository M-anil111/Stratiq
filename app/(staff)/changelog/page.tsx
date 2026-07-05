'use client'
import { useEffect } from 'react'
import { Sparkles, Zap, Wrench, ShieldCheck } from 'lucide-react'
import { APP_VERSION, CHANGELOG, type ChangelogTag } from '@/lib/version'

const TAG_STYLES: Record<ChangelogTag, { label: string; cls: string; Icon: any }> = {
  feature: { label: 'Feature', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/20', Icon: Zap },
  fix: { label: 'Fix', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20', Icon: Wrench },
  security: { label: 'Security', cls: 'bg-red-500/10 text-red-300 border-red-500/20', Icon: ShieldCheck },
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

export default function ChangelogPage() {
  useEffect(() => {
    try {
      localStorage.setItem('changelog_seen_version', APP_VERSION)
    } catch {}
  }, [])

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-sky-400" />
          <h1 className="text-2xl font-bold text-white">What&apos;s New</h1>
        </div>
        <p className="text-slate-400 text-sm">The latest features, fixes, and improvements in Stratiq</p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          Current version v{APP_VERSION}
        </div>
      </div>

      <div className="relative pl-6 border-l border-white/[0.1] space-y-8">
        {CHANGELOG.map((entry) => {
          const tag = TAG_STYLES[entry.tag]
          const isCurrent = entry.version === APP_VERSION
          return (
            <div key={entry.version} className="relative">
              <span className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-slate-900 ${isCurrent ? 'bg-sky-400' : 'bg-slate-600'}`} />
              <div className="glass-card p-5">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <h2 className="text-lg font-semibold text-white">v{entry.version}</h2>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${tag.cls}`}>
                    <tag.Icon className="h-3 w-3" />
                    {tag.label}
                  </span>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/[0.06] text-slate-300">Current</span>
                  )}
                  <span className="text-xs text-slate-500 ml-auto">{formatDate(entry.date)}</span>
                </div>
                <p className="text-sm font-medium text-slate-200 mb-3">{entry.title}</p>
                <ul className="space-y-1.5">
                  {entry.changes.map((c, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-400">
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

      <p className="mt-10 text-center text-xs text-slate-500">Stratiq v{APP_VERSION}</p>
    </div>
  )
}
