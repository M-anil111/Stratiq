import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Social | Stratiq' }

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
