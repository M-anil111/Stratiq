import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Leads | Stratiq' }

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
