import { z } from 'zod'

/**
 * 「咩」项目的纯业务规则。
 *
 * 这个文件不依赖 Next.js、Prisma 或浏览器 API，便于未来在 API、后台任务、
 * 测试中复用同一套规则，避免前后端各写一份校验。
 */
export const PROJECT_LIMITS = {
  titleMax: 80,
  summaryMax: 240,
  descriptionMax: 5000,
  moderationNoteMax: 500,
} as const

export const projectSubmissionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, '项目标题至少 2 个字')
    .max(PROJECT_LIMITS.titleMax, `项目标题最多 ${PROJECT_LIMITS.titleMax} 个字`),
  summary: z
    .string()
    .trim()
    .min(10, '一句话介绍至少 10 个字')
    .max(PROJECT_LIMITS.summaryMax, `一句话介绍最多 ${PROJECT_LIMITS.summaryMax} 个字`),
  description: z
    .string()
    .trim()
    .min(30, '项目说明至少 30 个字，先把想做什么讲清楚')
    .max(
      PROJECT_LIMITS.descriptionMax,
      `项目说明最多 ${PROJECT_LIMITS.descriptionMax} 个字`,
    ),
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
