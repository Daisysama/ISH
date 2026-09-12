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
  tagMax: 16,
  typeTagMaxCount: 16,
  seekingTagMaxCount: 12,
  customTagMaxCount: 8,
  platformMaxCount: 5,
  groupContactMax: 300,
  profileTagMaxCount: 20,
} as const

export const PROJECT_TAG_GROUPS = [
  {
    label: '类型与玩法',
    options: [
      '独立游戏', '视觉小说 / AVG', 'Galgame', 'RPG', 'JRPG', 'CRPG', 'ARPG', 'SRPG',
      '动作', 'FPS', 'TPS', '策略', 'RTS', '回合制', '即时制', '卡牌', '卡牌构筑',
      '塔防', '模拟经营', 'Roguelike', '类银河战士恶魔城', '魂Like', '开放世界', '沙盒',
      '生存', '建造', '采集', '养成', '解谜', '冒险', '探索', '音乐游戏', '竞速', '体育',
      '派对', '休闲', '放置', '剧情驱动', '强叙事', '群像', '多结局', '时间循环', '高难度',
      '实验作品',
    ],
  },
  {
    label: '游玩方式',
    options: ['单人', '多人', '本地合作', '在线合作', 'PVE', 'PVP', 'PvPvE', 'MMO', '异步多人'],
  },
  {
    label: '题材与风格',
    options: [
      '科幻', '奇幻', '校园', '历史', '悬疑', '推理', '恐怖', '治愈', '喜剧', '黑暗', '日常',
      '末日', '赛博朋克', '太空', '军事', '二次元', '二游 / 二次元手游', '国风', '古风', '武侠',
      '仙侠', '像素', '2D', '3D', 'Live2D', '手绘', '动漫风', '写实', '低多边形', '复古',
    ],
  },
  {
    label: '关系与受众',
    options: [
      '一般向', 'BG', '百合', 'BL', '恋爱', '友情', '亲情', '后宫', '逆后宫', '男性向',
      '女性向', '乙女', '无恋爱主线', '全年龄',
    ],
  },
] as const

export const PROJECT_TYPE_OPTIONS = PROJECT_TAG_GROUPS.flatMap((group) => group.options)

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
export const projectRevisionIdSchema = z.string().uuid('修改版本 ID 无效')

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
