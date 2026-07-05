import { History } from 'lucide-react'

export default function SettingsChangelogPage() {
  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <History className="h-6 w-6 text-sky-400" /> Changelog
        </h1>
        <p className="text-slate-400 text-sm">What&apos;s new and recently shipped in Stratiq</p>
      </div>

      <div className="glass-card rounded-2xl p-8 text-center">
        <p className="text-slate-400 text-sm">
          Release notes will appear here as new features ship.
        </p>
      </div>
    </div>
  )
}
