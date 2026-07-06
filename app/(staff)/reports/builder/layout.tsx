import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Report Builder | Stratiq' }

export default function ReportBuilderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
