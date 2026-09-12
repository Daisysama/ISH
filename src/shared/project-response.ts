export const PROJECT_RESPONSE_STATUS_LABELS = {
  PENDING: '等待回应',
  APPROVED: '已接受',
  REJECTED: '已婉拒',
  WITHDRAWN: '已撤回',
} as const

export type ProjectResponseStatusValue = keyof typeof PROJECT_RESPONSE_STATUS_LABELS

export type ProjectResponseActionResult = {
  ok: boolean
  error?: string
}
