export const PROJECT_STATUS_LABELS = {
  PENDING: '待审核',
  PUBLISHED: '已发布',
  REJECTED: '未通过',
  HIDDEN: '经网站核查暂时下架',
} as const

export const PROJECT_STAGE_LABELS = {
  IDEA: '只有一个点子',
  WRITING: '已有设定 / 文案',
  CONCEPT: '已有概念素材',
  PROTOTYPE: '已有原型',
  DEMO: '已有 Demo',
  DEVELOPING: '正在开发',
  TEAM: '已经有小团队',
  COMPLETED: '已经完成',
  LIVE: '持续运营中',
} as const

export const PROJECT_PURPOSE_LABELS = {
  COLLABORATE: '寻找同行',
  PLAYTEST: '邀请试玩',
  FEEDBACK: '征求反馈',
  PROMOTE: '宣传作品',
  SHARE: '分享想法',
} as const

export const PROJECT_AUDIENCE_LABELS = {
  EVERYONE: '大家都可以',
  COLLABORATORS: '主要找同行',
  PLAYERS: '主要找玩家',
} as const

export const GROUP_ACCESS_LABELS = {
  PUBLIC: '公开展示，大家都可以加入',
  APPROVAL_REQUIRED: '申请通过后展示',
  PRIVATE: '暂不对外展示',
} as const

export type ProjectStatusValue = keyof typeof PROJECT_STATUS_LABELS
export type ProjectStageValue = keyof typeof PROJECT_STAGE_LABELS
export type ProjectPurposeValue = keyof typeof PROJECT_PURPOSE_LABELS
export type ProjectAudienceValue = keyof typeof PROJECT_AUDIENCE_LABELS
export type GroupAccessModeValue = keyof typeof GROUP_ACCESS_LABELS

export type ProjectFormField =
  | 'title'
  | 'summary'
  | 'description'
  | 'stage'
  | 'purpose'
  | 'audience'
  | 'typeTags'
  | 'seekingTags'
  | 'platforms'
  | 'externalUrl'
  | 'groupType'
  | 'groupContact'
  | 'groupAccessMode'

export type ProjectFormValues = {
  title: string
  summary: string
  description: string
  stage: ProjectStageValue
  purpose: ProjectPurposeValue
  audience: ProjectAudienceValue
  typeTags: string[]
  customTypeTags: string[]
  seekingTags: string[]
  customSeekingTags: string[]
  platforms: string[]
  externalUrl: string
  groupType: string
  groupContact: string
  groupAccessMode: GroupAccessModeValue
  allowIshJoinGroup: boolean
}

export type ProjectFormState = {
  error?: string
  field?: ProjectFormField
  values?: ProjectFormValues
  attempt?: string
}

export type ModerationFormState = {
  error?: string
  success?: string
}
