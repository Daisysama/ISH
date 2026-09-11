export const PROJECT_STATUS_LABELS = {
  PENDING: '待审核',
  PUBLISHED: '已发布',
  REJECTED: '未通过',
} as const

export type ProjectStatusValue = keyof typeof PROJECT_STATUS_LABELS

export type ProjectFormField = 'title' | 'summary' | 'description'

export type ProjectFormState = {
  error?: string
  field?: ProjectFormField
}

export type ModerationFormState = {
  error?: string
  success?: string
}
