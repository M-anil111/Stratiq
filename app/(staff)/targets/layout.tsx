import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Targets | Stratiq' }

export default function TargetsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
