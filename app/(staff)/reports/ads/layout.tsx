import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Ads Analysis | Stratiq' }

export default function AdsAnalysisLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
