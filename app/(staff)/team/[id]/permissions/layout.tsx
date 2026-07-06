import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'User Access | Stratiq' }

export default function UserPermissionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
