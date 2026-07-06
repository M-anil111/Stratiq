import { redirect } from 'next/navigation'

// Team management lives at the top-level /team route. This settings entry
// redirects there so the settings nav resolves to a real page.
export default function SettingsTeamPage() {
  redirect('/team')
}
