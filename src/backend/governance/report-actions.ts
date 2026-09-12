'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

import { getCurrentAdmin, getSiteOwnerUserId } from '@/backend/auth/admin'
import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'

export type ReportState = { error?: string; success?: string }
const uuid = z.string().uuid()

export async function submitUpdateReportAction(_previous: ReportState, formData: FormData): Promise<ReportState> {
  const reporter = await getCurrentUser()
  if (!reporter) redirect('/login')
  const updateId = uuid.safeParse(formData.get('updateId'))
  const projectId = uuid.safeParse(formData.get('projectId'))
  const parsed = z.object({
    reason: z.enum(['HARASSMENT', 'MISLEADING', 'RIGHTS', 'OTHER']),
    statement: z.string().trim().min(10, '请至少写 10 个字说明具体问题。').max(2000, '说明最多 2000 字。'),
  }).safeParse({ reason: formData.get('reason'), statement: formData.get('statement') })
  if (!updateId.success || !projectId.success) return { error: '内容链接无效。' }
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  let reported = false
  try {
    await db.$transaction(async tx => {
      // 与下架裁决共用内容行锁，防止已经下架后才插入一条永久待审举报。
      await tx.$queryRaw`SELECT id FROM project_updates WHERE id = ${updateId.data} FOR UPDATE`
      const update = await tx.projectUpdate.findFirst({ where: { id: updateId.data, projectId: projectId.data, status: 'PUBLISHED' },
        select: { id: true, authorId: true, title: true, body: true, project: { select: { creatorId: true, title: true } } } })
      if (!update) throw new Error('NOT_PUBLIC')
      if (update.authorId === reporter.id || update.project.creatorId === reporter.id) throw new Error('SELF_REPORT')
      const today = new Date(); today.setUTCHours(0, 0, 0, 0)
      const daily = await tx.projectUpdateReport.count({ where: { reporterId: reporter.id, createdAt: { gte: today } } })
      if (daily >= 10) throw new Error('DAILY_LIMIT')
      const report = await tx.projectUpdateReport.create({ data: {
        updateId: update.id, reporterId: reporter.id, reason: parsed.data.reason, statement: parsed.data.statement,
        titleSnapshot: update.title, bodySnapshot: update.body,
      } })
      await tx.projectUpdateReportEvent.create({ data: { reportId: report.id, actorUserId: reporter.id, action: 'SUBMITTED' } })
      const staff = await tx.siteAdmin.findMany({ where: { active: true, permissions: { has: 'REPORT_REVIEW' } }, select: { userId: true } })
      const reviewers = new Set(staff.map(item => item.userId))
      const siteOwnerId = getSiteOwnerUserId()
      if (siteOwnerId) reviewers.add(siteOwnerId)
      reviewers.delete(reporter.id)
      reviewers.delete(update.project.creatorId)
      if (update.authorId) reviewers.delete(update.authorId)
      await createNotifications(tx, [...reviewers].map(id => ({
        recipientUserId: id, sourceKey: `report:${report.id}`, type: 'UPDATE_REPORT_SUBMITTED',
        title: '有公开动态被举报', summary: `项目「${update.project.title}」收到一条内容举报，需独立核查。`, href: '/admin/reports',
      })))
      if (reviewers.size === 0 && siteOwnerId) await createNotifications(tx, [{
        recipientUserId: siteOwnerId, sourceKey: `report-assignment:${report.id}`,
        type: 'REPORT_ASSIGNMENT_NEEDED', title: '举报需要独立审查员',
        summary: '当前具备举报审查权限的人员均与举报有关，请另行授权。', href: '/admin/staff',
      }])
      reported = true
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_PUBLIC') return { error: '这条动态已不公开或已被处理，请刷新后再试。' }
      if (error.message === 'SELF_REPORT') return { error: '自己的动态或本人发起项目请走纠错流程，不需举报自己。' }
      if (error.message === 'DAILY_LIMIT') return { error: '今天提交的举报已达上限，请明天再试。' }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { error: '您已经举报过这条动态，可在「我的举报」查看处理结果。' }
    throw error
  }
  if (reported) {
    revalidatePath('/admin/reports')
    revalidatePath('/reports')
    revalidatePath('/notifications')
  }
  return { success: '已收到举报。项目发起人不能查看您的举报内容，也不能审核此案。' }
}

export async function decideUpdateReportAction(_previous: ReportState, formData: FormData): Promise<ReportState> {
  const admin = await getCurrentAdmin('REPORT_REVIEW')
  if (!admin) return { error: '您没有独立审查举报的权限。' }
  const id = uuid.safeParse(formData.get('reportId'))
  const parsed = z.object({ decision: z.enum(['NO_VIOLATION', 'CONTENT_REMOVED']),
    reason: z.string().trim().min(10, '请写至少 10 个字处理依据。').max(2000) }).safeParse({
    decision: formData.get('decision'), reason: formData.get('reason'),
  })
  if (!id.success) return { error: '举报记录无效。' }
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      const source = await tx.projectUpdateReport.findUnique({ where: { id: id.data }, select: { updateId: true } })
      if (!source) throw new Error('ALREADY_REVIEWED')
      // 先锁内容，再修改具体举报；并行审核同一内容时不会互相等待成死锁。
      await tx.$queryRaw`SELECT id FROM project_updates WHERE id = ${source.updateId} FOR UPDATE`
      const report = await tx.projectUpdateReport.findUnique({ where: { id: id.data },
        select: { id: true, status: true, updateId: true, reporterId: true,
          update: { select: { status: true, title: true, authorId: true, project: { select: { id: true, creatorId: true, title: true } } } } },
      })
      if (!report || report.status !== 'PENDING') throw new Error('ALREADY_REVIEWED')
      if (admin.id === report.reporterId || admin.id === report.update.authorId || admin.id === report.update.project.creatorId) throw new Error('REVIEW_CONFLICT')
      if (report.update.status !== 'PUBLISHED') throw new Error('NO_LONGER_PUBLIC')
      projectId = report.update.project.id
      const now = new Date()
      const changed = await tx.projectUpdateReport.updateMany({ where: { id: report.id, status: 'PENDING' }, data: {
        status: 'RESOLVED', decision: parsed.data.decision, decisionReason: parsed.data.reason,
        reviewedById: admin.id, reviewedAt: now,
      } })
      if (changed.count !== 1) throw new Error('ALREADY_REVIEWED')
      await tx.projectUpdateReportEvent.create({ data: { reportId: report.id, actorUserId: admin.id, action: parsed.data.decision, note: parsed.data.reason } })
      if (parsed.data.decision === 'CONTENT_REMOVED') {
        const hidden = await tx.projectUpdate.updateMany({ where: { id: report.updateId, status: 'PUBLISHED' }, data: {
          status: 'HIDDEN', reviewedById: admin.id, reviewedAt: now, rejectionReason: `网站经举报核查已暂时下架：${parsed.data.reason}`,
        } })
        if (hidden.count === 1) await tx.projectUpdateEvent.create({ data: {
          updateId: report.updateId, actorUserId: admin.id, type: 'HIDDEN', note: parsed.data.reason,
        } })
        // 同一内容的其他未决举报共享这次处理，不让剩余队列悬空。
        const duplicates = await tx.projectUpdateReport.findMany({ where: { updateId: report.updateId, status: 'PENDING' }, select: { id: true, reporterId: true } })
        if (duplicates.length) {
          await tx.projectUpdateReport.updateMany({ where: { id: { in: duplicates.map(item => item.id) }, status: 'PENDING' }, data: {
            status: 'RESOLVED', decision: 'CONTENT_REMOVED', decisionReason: parsed.data.reason,
            reviewedById: admin.id, reviewedAt: now,
          } })
          await tx.projectUpdateReportEvent.createMany({ data: duplicates.map(item => ({
            reportId: item.id, actorUserId: admin.id, action: 'CONTENT_REMOVED', note: `合并处理：${parsed.data.reason}`,
          })) })
        }
        await createNotifications(tx, duplicates.map(item => ({
          recipientUserId: item.reporterId, sourceKey: `report-result:${item.id}`,
          type: 'UPDATE_REPORT_RESULT', title: '您的举报已有处理结果',
          summary: `项目「${report.update.project.title}」的相关内容已暂时下架。`, href: '/reports',
        })))
        await tx.userNotification.updateMany({ where: { sourceKey: { in: duplicates.map(item => `report:${item.id}`) }, readAt: null }, data: { readAt: now } })
      }
      await tx.userNotification.updateMany({ where: { sourceKey: `report:${report.id}`, readAt: null }, data: { readAt: now } })
      const outcome = parsed.data.decision === 'CONTENT_REMOVED' ? '相关动态已暂时下架' : '审核后未发现需要下架的违规'
      await createNotifications(tx, [{
        recipientUserId: report.reporterId, sourceKey: `report-result:${report.id}`, type: 'UPDATE_REPORT_RESULT',
        title: '您的举报已有处理结果', summary: `项目「${report.update.project.title}」：${outcome}。`, href: '/reports',
      }])
      if (parsed.data.decision === 'CONTENT_REMOVED') {
        const affected = new Set([report.update.project.creatorId, report.update.authorId].filter((value): value is string => Boolean(value)))
        affected.delete(report.reporterId)
        await createNotifications(tx, [...affected].map(userId => ({
          recipientUserId: userId, sourceKey: `reported-update-hidden:${report.id}`, type: 'PROJECT_UPDATE_HIDDEN',
          title: '项目动态已暂时下架', summary: `项目「${report.update.project.title}」的动态经网站审查暂时下架，处理依据与申诉入口在审核记录中。`,
          href: `/projects/${projectId}/updates`,
        })))
      }
      const ownerId = getSiteOwnerUserId()
      if (ownerId && admin.id !== ownerId) await createNotifications(tx, [{
        recipientUserId: ownerId, sourceKey: `owner-report-decision:${report.id}`,
        type: 'OWNER_REPORT_REVIEWED', title: '管理员处理了一条内容举报',
        summary: `${admin.displayName} 已处理项目「${report.update.project.title}」的举报；裁决与依据已留档。`,
        href: '/admin/reports',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'ALREADY_REVIEWED') return { error: '这条举报已被处理，请刷新页面。' }
    if (error instanceof Error && error.message === 'REVIEW_CONFLICT') return { error: '您与被举报内容有关，请让另一位网站管理员处理。' }
    if (error instanceof Error && error.message === 'NO_LONGER_PUBLIC') return { error: '内容已不公开，请由站主核对并处理此条举报。' }
    throw error
  }
  revalidatePath('/admin/reports')
  revalidatePath('/admin/moderation')
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/updates`)
  revalidatePath('/reports')
  revalidatePath('/notifications')
  return { success: '已处理并通知举报人；如需下架，内容已从公开列表撤下。' }
}
