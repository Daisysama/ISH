export const PROJECT_STATUS_LABELS = {
  PENDING: '待审核',
  PUBLISHED: '已发布',
  REJECTED: '未通过',
} as const

export const PROJECT_STAGE_LABELS = {
  IDEA: '只有一个点子',
  WRITING: '已有设定 / 文案',
  CONCEPT: '已有概念素材',
  PROTOTYPE: '已有原型',
  DEMO: '已有 Demo',
  DEVELOPING: '正在开发',
  TEAM: '已经有小团队',
} as const

export type ProjectStatusValue = keyof typeof PROJECT_STATUS_LABELS
export type ProjectStageValue = keyof typeof PROJECT_STAGE_LABELS

export type ProjectFormField =
  | 'title'
  | 'summary'
  | 'description'
  | 'stage'
  | 'typeTags'
  | 'seekingTags'
  | 'platforms'
  | 'externalUrl'
  | 'groupType'
  | 'groupContact'

export type ProjectFormState = {
  error?: string
  field?: ProjectFormField
}

export type ModerationFormState = {
  error?: string
  success?: string
}
