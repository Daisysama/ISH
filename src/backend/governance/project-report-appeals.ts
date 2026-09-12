'use server'

import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { getCurrentAdmin, getSiteOwnerUserId, isSiteOwner } from '@/backend/auth/admin'
import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'
import { refreshProjectReports } from '@/backend/governance/project-report-refresh'
import type { ProjectReportState } from '@/backend/governance/project-reports'

const uuid = z.string().uuid()
const explanation = z.string().trim().min(10, '请写至少 10 个字说明理由。').max(2000)

export async function appealProjectUnlistingAction(_previous: ProjectReportState, data: FormData): Promise<ProjectReportState> {
  const founder = await getCurrentUser()
  if (!founder) return { error: '请登录后查看自己的项目。' }
  const id = uuid.safeParse(data.get('reportId'))
  const statement = explanation.safeParse(data.get('statement'))
  if (!id.success || !statement.success) return { error: '请核对项目编号并填写至少 10 字申诉说明。' }
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      const source = await tx.projectReport.findUnique({ where: { id: id.data }, select: { projectId: true } })
      if (!source) throw new Error('NOT_ELIGIBLE')
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${source.projectId} FOR UPDATE`
      const report = await tx.projectReport.findUnique({ where: { id: id.data }, include: {
        project: { select: { id: true, title: true, creatorId: true, status: true } },
      } })
      if (!report || report.project.creatorId !== founder.id || report.project.status !== 'HIDDEN' ||
        report.decision !== 'UNLISTED' || report.mergedIntoId) throw new Error('NOT_ELIGIBLE')
      projectId = report.projectId
      const appeal = await tx.projectReportAppeal.create({ data: {
        reportId: report.id, appellantId: founder.id, originalReviewerId: report.reviewedById,
        reporterIdSnapshot: report.reporterId, reasonSnapshot: report.decisionReason ?? '原处理未填写原因',
        statement: statement.data,
      } })
      await tx.projectReportAppealEvent.create({ data: { appealId: appeal.id, actorUserId: founder.id, action: 'SUBMITTED', reason: statement.data } })
      const staff = await tx.siteAdmin.findMany({ where: { active: true, permissions: { has: 'REPORT_REVIEW' } }, select: { userId: true } })
      const reviewers = new Set(staff.map(person => person.userId))
      const ownerId = getSiteOwnerUserId()
      if (ownerId) reviewers.add(ownerId)
      reviewers.delete(founder.id); reviewers.delete(report.reporterId)
      if (report.reviewedById) reviewers.delete(report.reviewedById)
      await createNotifications(tx, [...reviewers].map(recipientUserId => ({ recipientUserId,
        sourceKey: `project-report-appeal:${appeal.id}`, type: 'PROJECT_REPORT_APPEAL',
        title: '有项目下架申诉待独立审查', summary: `项目「${report.project.title}」的发起人请求复核。`, href: '/admin/reports',
      })))
      if (!reviewers.size && ownerId) await createNotifications(tx, [{ recipientUserId: ownerId,
        sourceKey: `project-appeal-assignment:${appeal.id}`, type: 'REPORT_ASSIGNMENT_NEEDED',
        title: '项目申诉缺少独立审查员', summary: '原审查人、发起人和举报人必须回避，请另行授权。', href: '/admin/staff',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_ELIGIBLE') return { error: '本次下架申诉记录已失效，请刷新页面核对。' }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { error: '本次下架已提交过申诉，请查看进度。' }
    throw error
  }
  refreshProjectReports(projectId)
  return { success: '申诉已交另一位网站管理员或无利益冲突的站主，原审查人不能裁决。' }
}

export async function decideProjectUnlistingAppealAction(_previous: ProjectReportState, data: FormData): Promise<ProjectReportState> {
  const admin = await getCurrentAdmin('REPORT_REVIEW')
  if (!admin) return { error: '您没有项目下架申诉审查权限。' }
  const id = uuid.safeParse(data.get('appealId'))
  const decision = z.enum(['UPHELD', 'RESTORED']).safeParse(data.get('decision'))
  const reason = explanation.safeParse(data.get('reason'))
  if (!id.success || !decision.success || !reason.success) return { error: '请核对案件、结论和至少 10 字依据。' }
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      const source = await tx.projectReportAppeal.findUnique({ where: { id: id.data }, select: { report: { select: { projectId: true } } } })
      if (!source) throw new Error('STALE')
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${source.report.projectId} FOR UPDATE`
      const appeal = await tx.projectReportAppeal.findUnique({ where: { id: id.data }, include: {
        report: { include: { project: { select: { id: true, title: true, status: true, creatorId: true } } } },
      } })
      if (!appeal || appeal.status !== 'PENDING' || appeal.report.project.status !== 'HIDDEN') throw new Error('STALE')
      if ([appeal.appellantId, appeal.originalReviewerId, appeal.reporterIdSnapshot, appeal.report.project.creatorId].includes(admin.id)) throw new Error('CONFLICT')
      projectId = appeal.report.projectId
      const now = new Date()
      const changed = await tx.projectReportAppeal.updateMany({ where: { id: appeal.id, status: 'PENDING' }, data: {
        status: 'RESOLVED', decision: decision.data, decisionReason: reason.data, reviewedById: admin.id, reviewedAt: now,
      } })
      if (changed.count !== 1) throw new Error('STALE')
      await tx.projectReportAppealEvent.create({ data: { appealId: appeal.id, actorUserId: admin.id, action: decision.data, reason: reason.data } })
      if (decision.data === 'RESTORED') {
        const changedProject = await tx.project.updateMany({ where: { id: projectId, status: 'HIDDEN' },
          data: { status: 'PUBLISHED', rejectionReason: null } })
        if (changedProject.count !== 1) throw new Error('STALE')
        const reporters = await tx.projectReport.findMany({ where: { projectId, decision: 'UNLISTED' }, select: { reporterId: true } })
        await createNotifications(tx, [...new Set(reporters.map(item => item.reporterId))].map(recipientUserId => ({
          recipientUserId, sourceKey: `project-restored:${appeal.id}:${recipientUserId}`, type: 'PROJECT_REPORT_CORRECTED',
          title: '您举报的项目有新的处理结论', summary: `项目「${appeal.report.project.title}」原下架已撤销，举报及处理记录仍保留。`, href: '/reports',
        })))
      }
      await tx.userNotification.updateMany({ where: { sourceKey: `project-report-appeal:${appeal.id}`, readAt: null }, data: { readAt: now } })
      await createNotifications(tx, [{ recipientUserId: appeal.appellantId,
        sourceKey: `project-appeal-result:${appeal.id}`, type: 'PROJECT_REPORT_APPEAL_RESULT',
        title: decision.data === 'RESTORED' ? '项目下架申诉成立' : '项目下架申诉已审结',
        summary: `项目「${appeal.report.project.title}」的独立审查结论与依据保留在项目详情。`, href: `/projects/${projectId}?from=notifications`,
      }])
      const ownerId = getSiteOwnerUserId()
      if (ownerId && admin.id !== ownerId) await createNotifications(tx, [{ recipientUserId: ownerId,
        sourceKey: `owner-project-appeal:${appeal.id}`, type: 'OWNER_PROJECT_APPEAL_RESULT',
        title: '管理员处理了项目下架申诉', summary: `项目「${appeal.report.project.title}」的原决定与新结论均留档。`, href: '/admin/reports',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE') return { error: '项目或案件状态已变化，请刷新页面。' }
    if (error instanceof Error && error.message === 'CONFLICT') return { error: '原审查员、发起人和举报人不能审查本案。' }
    throw error
  }
  refreshProjectReports(projectId)
  return { success: decision.data === 'RESTORED' ? '已恢复项目公开，原下架决定和复核依据留档。' : '已维持下架并通知发起人。' }
}

/** 站主纠正他人下架决定，原操作和本人纠错分开留存。 */
export async function restoreProjectByOwnerAction(_previous: ProjectReportState, data: FormData): Promise<ProjectReportState> {
  const owner = await getCurrentUser()
  if (!owner || !isSiteOwner(owner.id)) return { error: '只有站主可直接纠正管理员的项目下架。' }
  const id = uuid.safeParse(data.get('reportId'))
  const reason = explanation.safeParse(data.get('reason'))
  if (!id.success || !reason.success) return { error: '请核对案件并填写至少 10 字纠错依据。' }
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      const source = await tx.projectReport.findUnique({ where: { id: id.data }, select: { projectId: true } })
      if (!source) throw new Error('STALE')
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${source.projectId} FOR UPDATE`
      const report = await tx.projectReport.findUnique({ where: { id: id.data }, include: {
        project: { select: { id: true, title: true, status: true, creatorId: true } },
      } })
      if (!report || report.mergedIntoId || report.decision !== 'UNLISTED' || report.project.status !== 'HIDDEN') throw new Error('STALE')
      if ([report.reviewedById, report.project.creatorId, report.reporterId].includes(owner.id)) throw new Error('CONFLICT')
      projectId = report.projectId
      await tx.project.updateMany({ where: { id: projectId, status: 'HIDDEN' }, data: { status: 'PUBLISHED', rejectionReason: null } })
      await tx.projectReportEvent.create({ data: { reportId: report.id, actorUserId: owner.id, action: 'OWNER_RESTORED', note: reason.data } })
      const pending = await tx.projectReportAppeal.findUnique({ where: { reportId: report.id }, select: { id: true, status: true } })
      if (pending?.status === 'PENDING') {
        await tx.projectReportAppeal.update({ where: { id: pending.id }, data: {
          status: 'RESOLVED', decision: 'RESTORED', decisionReason: `站主撤销原下架：${reason.data}`,
          reviewedById: owner.id, reviewedAt: new Date(),
        } })
        await tx.projectReportAppealEvent.create({ data: { appealId: pending.id, actorUserId: owner.id,
          action: 'OWNER_RESTORED_ORIGINAL', reason: reason.data } })
        await tx.userNotification.updateMany({ where: { sourceKey: `project-report-appeal:${pending.id}`, readAt: null }, data: { readAt: new Date() } })
      }
      const reporters = await tx.projectReport.findMany({ where: { projectId, decision: 'UNLISTED' }, select: { reporterId: true } })
      const affected = new Set([report.project.creatorId, report.reviewedById, ...reporters.map(item => item.reporterId)])
      affected.delete(owner.id)
      await createNotifications(tx, [...affected].filter((value): value is string => Boolean(value)).map(recipientUserId => ({
        recipientUserId, sourceKey: `owner-project-restored:${report.id}:${recipientUserId}`, type: 'PROJECT_REPORT_CORRECTED',
        title: '项目下架决定已由站主纠正', summary: `项目「${report.project.title}」已恢复公开，原决定和撤销理由均保留。`,
        href: recipientUserId === report.project.creatorId ? `/projects/${projectId}?from=notifications` : '/reports',
      })))
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE') return { error: '项目或案件状态已变化，请刷新页面。' }
    if (error instanceof Error && error.message === 'CONFLICT') return { error: '站主与本案有关，请交由另一位独立管理员。' }
    throw error
  }
  refreshProjectReports(projectId)
  return { success: '项目已恢复公开，原决定与撤销依据保留。' }
}
