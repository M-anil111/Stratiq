import type { Metadata } from 'next'

export const metadata: Metadata = { title: "What's New | Stratiq" }

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
