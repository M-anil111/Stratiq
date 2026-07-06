import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Reports | Stratiq' }

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
