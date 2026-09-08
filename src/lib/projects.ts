import { db } from '@/lib/db'

/**
 * 项目相关的常量与查询。
 *
 * 分类和「需要什么人」这两组选项放在这里，是为了让表单、详情页、
 * 以后的筛选器读同一份定义 —— 三处各写一份的话，迟早会对不上。
 */

/** 领域分类。顺序就是表单里的显示顺序。 */
export const CATEGORIES = [
  '产品',
  '内容',
  '设计',
  '技术',
  '研究',
  '公益',
  '其他',
] as const

/**
 * 投入预期。
 *
 * 这件事必须在项目页上写明白：一个人愿不愿意同行，取决于他知不知道
 * 对面期待的是「周末玩玩」还是「奔着做成」。让人自己猜，最后一定对不上。
 */
export const MODES = [
  {
    value: 'interest',
    label: '兴趣项目',
    hint: '业余时间做，做成了很好，做不成也不亏',
  },
  {
    value: 'serious',
    label: '认真做',
    hint: '奔着成事去，需要稳定投入和长期承诺',
  },
] as const

export type ModeValue = (typeof MODES)[number]['value']

/** 常见的同行者类型，作为快捷选项；表单里也允许自己写。 */
export const NEED_SUGGESTIONS = [
  '程序',
  '设计',
  '文案',
  '运营',
  '视频',
  '音乐',
  '翻译',
  '商务',
  '研究',
  '测试',
] as const

export function modeLabel(value: string): string {
  return MODES.find((m) => m.value === value)?.label ?? value
}

// ---------------------------------------------------------------- 查询

/** 我发起的项目，新的在前。 */
export async function listProjectsByOwner(ownerId: string) {
  return db.project.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * 按 id 取项目，连发起人一起带出来。
 *
 * 项目现在是公开可见的 —— 「发现项目」这件事的前提就是别人能看到它。
 * 所以这里不做权限过滤，能不能改由调用方自己比对 ownerId。
 */
export async function getProject(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, displayName: true, email: true } },
    },
  })
}

export type ProjectWithOwner = NonNullable<Awaited<ReturnType<typeof getProject>>>
