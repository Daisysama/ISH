import type { ProjectPurpose } from '@prisma/client'

export const PROJECT_RESPONSE_LIMITS = {
  maxRoles: 6,
  roleMax: 24,
  messageMin: 10,
  messageMax: 500,
} as const

const PURPOSE_RESPONSE_OPTIONS: Record<ProjectPurpose, string[]> = {
  COLLABORATE: [],
  PLAYTEST: ['玩家试玩', '测试反馈'],
  FEEDBACK: ['提供反馈', '玩家体验'],
  PROMOTE: ['参与宣传'],
  SHARE: ['交流想法'],
}

export function getProjectResponseOptions(project: {
  purpose: ProjectPurpose
  seekingTags: string[]
}) {
  return [...new Set([
    ...project.seekingTags,
    ...PURPOSE_RESPONSE_OPTIONS[project.purpose],
    '其他',
  ])]
}

export function projectAcceptsResponses(project: {
  purpose: ProjectPurpose
  seekingTags: string[]
  groupAccessMode: 'PUBLIC' | 'APPROVAL_REQUIRED' | 'PRIVATE'
}) {
  return project.seekingTags.length > 0
    || project.purpose === 'COLLABORATE'
    || project.purpose === 'PLAYTEST'
    || project.purpose === 'FEEDBACK'
    || project.groupAccessMode === 'APPROVAL_REQUIRED'
}
