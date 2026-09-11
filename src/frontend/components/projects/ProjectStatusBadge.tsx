import {
  PROJECT_STATUS_LABELS,
  type ProjectStatusValue,
} from '@/shared/project'

export function ProjectStatusBadge({ status }: { status: ProjectStatusValue }) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      {PROJECT_STATUS_LABELS[status]}
    </span>
  )
}
