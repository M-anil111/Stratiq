import { redirect } from 'next/navigation'

// The full changelog lives at /changelog (rich timeline from lib/version.ts).
// This settings entry just forwards there so there's a single source of truth.
export default function SettingsChangelogPage() {
  redirect('/changelog')
}
