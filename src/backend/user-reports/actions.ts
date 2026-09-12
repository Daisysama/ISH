'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentAdmin, getSiteOwnerUserId } from '@/backend/auth/admin'
import { getCurrentUser } from '@/backend/auth/current-user'
import { getWritingUser } from '@/backend/auth/write-access'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'

export type UserReportState = { error?: string; success?: string }
const uuid = z.string().uuid()
const statement = z.string().trim().min(10, '请写至少 10 字的具体事实。').max(2000)
const categories = z.enum(['HARASSMENT', 'IMPERSONATION', 'RIGHTS', 'FRAUD', 'OTHER'])

export async function submitUserReportAction(_previous: UserReportState, data: FormData): Promise<UserReportState> {
  const reporter = await getWritingUser('COMMENTS')
  if (!reporter) return { error: '请登录并确认账号可用后再举报。' }
  const targetId = uuid.safeParse(data.get('targetId'))
  const category = categories.safeParse(data.get('category'))
  const details = statement.safeParse(data.get('statement'))
  if (!targetId.success || !category.success || !details.success) return { error: details.success ? '请选择问题类型并核对用户链接。' : details.error.issues[0].message }
  if (targetId.data === reporter.id) return { error: '不能举报自己的账号。' }
  try {
    await db.$transaction(async tx => {
      const target = await tx.user.findUnique({ where: { id: targetId.data }, select: { id: true, displayName: true } })
      if (!target) throw new Error('NOT_FOUND')
      const today = new Date(); today.setUTCHours(0, 0, 0, 0)
      if (await tx.userReport.count({ where: { reporterId: reporter.id, createdAt: { gte: today } } }) >= 5) throw new Error('LIMIT')
      if (await tx.userReport.count({ where: { reporterId: reporter.id, targetId: target.id, status: 'PENDING' } })) throw new Error('DUPLICATE')
      const report = await tx.userReport.create({ data: { reporterId: reporter.id, targetId: target.id,
        targetNameSnapshot: target.displayName, category: category.data, statement: details.data } })
      await tx.userReportEvent.create({ data: { reportId: report.id, actorUserId: reporter.id, action: 'SUBMITTED' } })
      const admins = await tx.siteAdmin.findMany({ where: { active: true, permissions: { has: 'REPORT_REVIEW' } }, select: { userId: true } })
      const eligible = new Set(admins.map(item => item.userId)); const ownerId = getSiteOwnerUserId()
      if (ownerId) eligible.add(ownerId)
      eligible.delete(target.id); eligible.delete(reporter.id)
      await createNotifications(tx, [...eligible].map(recipientUserId => ({ recipientUserId,
        sourceKey: `user-report:${report.id}`, type: 'USER_REPORT_PENDING', title: '有用户资料举报待审查',
        summary: `涉及用户「${target.displayName}」的举报等待网站独立审查。`, href: '/admin/user-reports',
      })))
      if (!eligible.size && ownerId) await createNotifications(tx, [{ recipientUserId: ownerId,
        sourceKey: `user-report-assignment:${report.id}`, type: 'REPORT_ASSIGNMENT_NEEDED',
        title: '用户举报需要独立审核员', summary: '举报人或被举报人有利益冲突，请另行授权网站管理员。', href: '/admin/staff',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') return { error: '目标账号已经不存在。' }
    if (error instanceof Error && error.message === 'LIMIT') return { error: '今天提交的用户举报已达上限。' }
    if (error instanceof Error && error.message === 'DUPLICATE') return { error: '您对这个账号已有待处理举报；可在此页查看进展。' }
    throw error
  }
  revalidatePath(`/users/${targetId.data}/report`)
  revalidatePath('/admin/user-reports')
  revalidatePath('/notifications')
  return { success: '举报已提交网站独立审核；这不是违规认定，处理结果会在消息和此页显示。' }
}

export async function withdrawUserReportAction(_previous: UserReportState, data: FormData): Promise<UserReportState> {
  const reporter = await getCurrentUser()
  const id = uuid.safeParse(data.get('reportId'))
  if (!reporter || !id.success) return { error: '记录已失效，请重新进入。' }
  const result = await db.$transaction(async tx => {
    const report = await tx.userReport.findFirst({ where: { id: id.data, reporterId: reporter.id, status: 'PENDING' }, select: { targetId: true } })
    if (!report) return null
    const changed = await tx.userReport.updateMany({ where: { id: id.data, reporterId: reporter.id, status: 'PENDING' }, data: { status: 'WITHDRAWN' } })
    if (!changed.count) return null
    await tx.userReportEvent.create({ data: { reportId: id.data, actorUserId: reporter.id, action: 'WITHDRAWN' } })
    await tx.userNotification.updateMany({ where: { sourceKey: `user-report:${id.data}`, readAt: null }, data: { readAt: new Date() } })
    return report.targetId
  })
  if (!result) return { error: '案件已处理或被撤回，请刷新。' }
  revalidatePath(`/users/${result}/report`)
  revalidatePath('/admin/user-reports')
  return { success: '已撤回；原始举报及撤回操作仍留在网站审计记录中。' }
}

export async function decideUserReportAction(_previous: UserReportState, data: FormData): Promise<UserReportState> {
  const admin = await getCurrentAdmin('REPORT_REVIEW')
  if (!admin) return { error: '您没有网站举报审核权限。' }
  const id = uuid.safeParse(data.get('reportId'))
  const decision = z.enum(['NO_VIOLATION', 'REFER_TO_SANCTIONS']).safeParse(data.get('decision'))
  const reason = z.string().trim().min(10, '请说明至少 10 字的处理依据。').max(2000).safeParse(data.get('reason'))
  if (!id.success || !decision.success || !reason.success) return { error: reason.success ? '处理结果或举报编号无效。' : reason.error.issues[0].message }
  try {
    await db.$transaction(async tx => {
      const item = await tx.userReport.findUnique({ where: { id: id.data } })
      if (!item || item.status !== 'PENDING') throw new Error('STALE')
      if (item.reporterId === admin.id || item.targetId === admin.id) throw new Error('CONFLICT')
      const changed = await tx.userReport.updateMany({ where: { id: item.id, status: 'PENDING' }, data: {
        status: 'RESOLVED', decision: decision.data, decisionReason: reason.data, reviewedById: admin.id, reviewedAt: new Date(),
      } })
      if (!changed.count) throw new Error('STALE')
      await tx.userReportEvent.create({ data: { reportId: item.id, actorUserId: admin.id, action: 'REVIEWED', note: reason.data } })
      await tx.userNotification.updateMany({ where: { sourceKey: `user-report:${item.id}`, readAt: null }, data: { readAt: new Date() } })
      await createNotifications(tx, [{ recipientUserId: item.reporterId, sourceKey: `user-report-result:${item.id}`,
        type: 'USER_REPORT_RESULT', title: '您的用户举报有处理结果',
        summary: decision.data === 'NO_VIOLATION' ? '网站暂未认定违规；审查依据请在原举报页查看。' : '网站已记录问题；账号措施将由管理员另行依法规则处理。',
        href: `/users/${item.targetId}/report`,
      }])
      const ownerId = getSiteOwnerUserId()
      if (ownerId && ownerId !== admin.id) await createNotifications(tx, [{ recipientUserId: ownerId,
        sourceKey: `owner-user-report:${item.id}`, type: 'OWNER_USER_REPORT_REVIEWED', title: '管理员处理了一条用户举报',
        summary: `处理依据和操作人已留档，请按需要核查。`, href: '/admin/user-reports',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE') return { error: '举报已经处理或撤回。' }
    if (error instanceof Error && error.message === 'CONFLICT') return { error: '举报人和被举报人必须回避，请交由另一位管理员审查。' }
    throw error
  }
  revalidatePath('/admin/user-reports')
  revalidatePath('/notifications')
  return { success: '独立审查结论已留档，并通知举报人和站主；进一步账号限制需要单独的处分操作。' }
}
