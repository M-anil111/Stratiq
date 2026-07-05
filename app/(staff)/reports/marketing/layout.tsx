import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Marketing Reports | Stratiq' }

export default function MarketingReportsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
