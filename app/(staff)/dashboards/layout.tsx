import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboards | Stratiq' }

export default function DashboardsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
