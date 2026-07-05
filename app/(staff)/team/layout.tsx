import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Team | Stratiq' }

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
