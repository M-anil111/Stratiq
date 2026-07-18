import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Deals | Stratiq' }

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
