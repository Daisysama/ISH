import { z } from 'zod'

/** 项目动态是对外内容；审核通过前只对作者、发起人和独立审核员可见。 */
export const projectUpdateSchema = z.object({
  title: z.string().trim().min(4, '标题至少写 4 个字。').max(80, '标题最多 80 个字。'),
  body: z.string().trim().min(10, '动态内容至少写 10 个字。').max(3000, '动态内容最多 3000 个字。'),
})

export const projectUpdateRejectionSchema = z.string().trim().min(10, '请写至少 10 个字说明退回原因。').max(500, '退回原因最多 500 个字。')
