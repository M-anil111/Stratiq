import { Badge } from './badge'
import type { ProjectStatus } from '@/types'

const statusMap: Record<ProjectStatus, { label: string; variant: any }> = {
  active: { label: 'Active', variant: 'active' },
  on_hold: { label: 'On Hold', variant: 'hold' },
  cancelled: { label: 'Cancelled', variant: 'cancelled' },
  completed: { label: 'Completed', variant: 'completed' },
  prospect: { label: 'Prospect', variant: 'prospect' },
  in_onboarding: { label: 'In Onboarding', variant: 'onboarding' },
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const config = statusMap[status] ?? { label: status, variant: 'secondary' }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
