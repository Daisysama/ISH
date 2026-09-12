export type ProjectReturnSource = 'home' | 'dashboard' | 'projects' | 'responses' | 'moderation' | 'appeals' | 'notifications' | 'profile'

const PROJECT_RETURN_DESTINATIONS: Record<ProjectReturnSource, { href: string; label: string }> = {
  home: { href: '/', label: '首页' },
  dashboard: { href: '/dashboard', label: '我的项目' },
  projects: { href: '/projects', label: '羊群广场' },
  responses: { href: '/dashboard/responses', label: '回应中心' },
  moderation: { href: '/admin/moderation', label: '项目审核' },
  appeals: { href: '/admin/removal-appeals', label: '同行移出申诉' },
  notifications: { href: '/notifications', label: '消息提醒' },
  profile: { href: '/profile', label: '个人资料' },
}

export function projectHref(projectId: string, from: ProjectReturnSource) {
  return `/projects/${projectId}?from=${from}`
}

export function resolveProjectReturn(
  raw: string | string[] | undefined,
  fallback: ProjectReturnSource,
  caseId?: string | string[],
) {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value && value in PROJECT_RETURN_DESTINATIONS) {
    if (value === 'appeals') {
      const id = Array.isArray(caseId) ? caseId[0] : caseId
      return {
        href: id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
          ? `/admin/removal-appeals#review-${id}` : '/admin/removal-appeals',
        label: '同行移出申诉',
      }
    }
    return PROJECT_RETURN_DESTINATIONS[value as ProjectReturnSource]
  }
  return PROJECT_RETURN_DESTINATIONS[fallback]
}
