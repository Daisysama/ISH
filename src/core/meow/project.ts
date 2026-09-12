import { z } from 'zod'

/**
 * 「咩」项目的纯业务规则。
 *
 * 这里不依赖 Next.js、Prisma 或浏览器 API，便于未来在 API、后台任务、
 * 测试中复用同一套规则，避免前后端各写一份校验。
 */
export const PROJECT_LIMITS = {
  titleMax: 40,
  summaryMax: 100,
  descriptionMax: 2000,
  moderationNoteMax: 500,
  tagMax: 12,
  typeTagMaxCount: 8,
  seekingTagMaxCount: 8,
  customTagMaxCount: 3,
  platformMaxCount: 5,
  groupContactMax: 300,
  profileTagMaxCount: 20,
} as const

export const PROJECT_TYPE_OPTIONS = [
  '独立游戏',
  '视觉小说 / AVG',
  'RPG',
  '动作',
  '冒险',
  '解谜',
  '模拟经营',
  '策略',
  '卡牌',
  '音乐游戏',
  '恐怖',
  '休闲',
  '多人',
  '叙事',
  '实验作品',
  'Galgame',
] as const

export const SEEKING_ROLE_OPTIONS = [
  '程序',
  '游戏策划',
  '关卡设计',
  '编剧',
  '文案',
  '原画',
  '角色设计',
  '场景美术',
  '像素美术',
  'UI / UX',
  '3D 建模',
  '动画',
  '特效',
  '音乐',
  '音效',
  '配音',
  '测试',
  '运营',
  '宣发',
  '翻译',
] as const

export const PLATFORM_OPTIONS = [
  'PC',
  'Web',
  'Steam',
  'itch.io',
  'TapTap',
  '移动端',
  'Nintendo Switch',
  'PlayStation',
  'Bilibili',
  'GitHub',
] as const

export const GROUP_TYPE_OPTIONS = ['QQ群', '微信群', '飞书', '其他'] as const

export const PROJECT_STAGE_VALUES = [
  'IDEA',
  'WRITING',
  'CONCEPT',
  'PROTOTYPE',
  'DEMO',
  'DEVELOPING',
  'TEAM',
  'COMPLETED',
  'LIVE',
] as const

export const PROJECT_PURPOSE_VALUES = [
  'COLLABORATE',
  'PLAYTEST',
  'FEEDBACK',
  'PROMOTE',
  'SHARE',
] as const

export const PROJECT_AUDIENCE_VALUES = ['EVERYONE', 'COLLABORATORS', 'PLAYERS'] as const

export const GROUP_ACCESS_VALUES = ['PUBLIC', 'APPROVAL_REQUIRED', 'PRIVATE'] as const

const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(PROJECT_LIMITS.tagMax, `单个标签最多 ${PROJECT_LIMITS.tagMax} 个字`)

const platformSchema = z.string().trim().min(1).max(30, '平台名称太长了')

const optionalUrlSchema = z
  .string()
  .trim()
  .max(500, '链接太长了，请换一个更直接的链接')
  .refine((value) => value === '' || /^https?:\/\//i.test(value), '链接请以 http:// 或 https:// 开头')
  .transform((value) => (value === '' ? undefined : value))

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export function parseCustomTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string') return []

  return dedupe(raw.split(/[,，、;；\n]+/)).slice(0, PROJECT_LIMITS.customTagMaxCount)
}

export function mergeTags(
  selected: FormDataEntryValue[],
  custom: string[],
  maxCount: number,
): string[] {
  return dedupe([
    ...selected.filter((value): value is string => typeof value === 'string'),
    ...custom,
  ]).slice(0, maxCount)
}

export const projectSubmissionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, '项目名称至少 2 个字')
    .max(PROJECT_LIMITS.titleMax, `项目名称最多 ${PROJECT_LIMITS.titleMax} 个字`),
  summary: z
    .string()
    .trim()
    .min(10, '一句话介绍至少 10 个字')
    .max(PROJECT_LIMITS.summaryMax, `一句话介绍最多 ${PROJECT_LIMITS.summaryMax} 个字`),
  description: z
    .string()
    .trim()
    .max(PROJECT_LIMITS.descriptionMax, `补充说明最多 ${PROJECT_LIMITS.descriptionMax} 个字`)
    .transform((value) => (value === '' ? undefined : value)),
  stage: z.enum(PROJECT_STAGE_VALUES),
  purpose: z.enum(PROJECT_PURPOSE_VALUES),
  audience: z.enum(PROJECT_AUDIENCE_VALUES),
  typeTags: z
    .array(tagSchema)
    .min(1, '至少选一个项目类型')
    .max(PROJECT_LIMITS.typeTagMaxCount, `项目类型最多选 ${PROJECT_LIMITS.typeTagMaxCount} 个`),
  seekingTags: z
    .array(tagSchema)
    .max(PROJECT_LIMITS.seekingTagMaxCount, `寻找的同行者最多选 ${PROJECT_LIMITS.seekingTagMaxCount} 个`),
  platforms: z
    .array(platformSchema)
    .max(PROJECT_LIMITS.platformMaxCount, `目标平台最多选 ${PROJECT_LIMITS.platformMaxCount} 个`),
  externalUrl: optionalUrlSchema,
  groupType: z
    .string()
    .trim()
    .max(30)
    .transform((value) => (value === '' ? undefined : value)),
  groupAccessMode: z.enum(GROUP_ACCESS_VALUES),
  groupContact: z
    .string()
    .trim()
    .max(PROJECT_LIMITS.groupContactMax, `群聊信息最多 ${PROJECT_LIMITS.groupContactMax} 个字`)
    .transform((value) => (value === '' ? undefined : value)),
  allowIshJoinGroup: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.groupAccessMode !== 'PRIVATE' && !value.groupContact) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['groupContact'],
      message: '选择公开或申请制群聊时，请留下群号、邀请链接或加群说明',
    })
  }

  if (value.allowIshJoinGroup && !value.groupContact) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['groupContact'],
      message: '邀请 ISH 加群时，请留下群号、邀请链接或加群说明',
    })
  }
})

export const projectIdSchema = z.string().uuid('项目 ID 无效')

export const moderationNoteSchema = z
  .string()
  .trim()
  .max(PROJECT_LIMITS.moderationNoteMax, `审核备注最多 ${PROJECT_LIMITS.moderationNoteMax} 个字`)

export const rejectionReasonSchema = z
  .string()
  .trim()
  .min(5, '拒绝公开时请至少写 5 个字，给创作者一个可执行的理由')
  .max(PROJECT_LIMITS.moderationNoteMax, `拒绝理由最多 ${PROJECT_LIMITS.moderationNoteMax} 个字`)

export type ProjectSubmission = z.infer<typeof projectSubmissionSchema>
