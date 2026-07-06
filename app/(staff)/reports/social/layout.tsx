import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Social Analytics | Stratiq' }

export default function SocialAnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
