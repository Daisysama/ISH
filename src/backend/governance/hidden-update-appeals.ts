'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getCurrentAdmin, getSiteOwnerUserId } from '@/backend/auth/admin'
import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'

export type HiddenAppealState = { error?: string; success?: string }
const uuid = z.string().uuid()

export async function submitHiddenUpdateAppealAction(_previous: HiddenAppealState, data: FormData): Promise<HiddenAppealState> {
  const author = await getCurrentUser()
  if (!author) return { error: '请先登录，才能申请网站复核。' }
  const id = uuid.safeParse(data.get('updateId'))
  const statement = z.string().trim().min(10, '请写至少 10 个字说明申诉依据。').max(2000).safeParse(data.get('statement'))
  if (!id.success) return { error: '动态记录无效。' }
  if (!statement.success) return { error: statement.error.issues[0].message }
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM project_updates WHERE id = ${id.data} FOR UPDATE`
      const update = await tx.projectUpdate.findUnique({ where: { id: id.data }, select: {
        id: true, status: true, authorId: true, rejectionReason: true, reviewedById: true,
        project: { select: { id: true, creatorId: true, title: true } },
        events: { where: { type: 'HIDDEN' }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } },
      } })
      if (!update || update.authorId !== author.id || update.status !== 'HIDDEN' || !update.events[0]) throw new Error('NOT_HIDDEN')
      projectId = update.project.id
      const original = await tx.projectUpdateReport.findFirst({ where: { updateId: update.id, decision: 'CONTENT_REMOVED' },
        orderBy: { reviewedAt: 'desc' }, select: { reporterId: true } })
      const appeal = await tx.projectUpdateRemovalAppeal.create({ data: {
        updateId: update.id, hiddenEventId: update.events[0].id, appellantId: author.id,
        originalReviewerId: update.reviewedById, reporterIdSnapshot: original?.reporterId,
        reasonSnapshot: update.rejectionReason || '原处理依据未提供', statement: statement.data,
      } })
      await tx.projectUpdateRemovalAppealEvent.create({ data: { appealId: appeal.id, actorUserId: author.id,
        action: 'SUBMITTED', reason: statement.data } })
      const staff = await tx.siteAdmin.findMany({ where: { active: true, permissions: { has: 'REPORT_REVIEW' } }, select: { userId: true } })
      const reviewers = new Set(staff.map(item => item.userId))
      const ownerId = getSiteOwnerUserId()
      if (ownerId) reviewers.add(ownerId)
      for (const excluded of [author.id, update.project.creatorId, update.reviewedById, original?.reporterId]) if (excluded) reviewers.delete(excluded)
      await createNotifications(tx, [...reviewers].map(userId => ({
        recipientUserId: userId, sourceKey: `hidden-update-appeal:${appeal.id}`,
        type: 'HIDDEN_UPDATE_APPEAL', title: '有已下架动态申请网站复核',
        summary: `项目「${update.project.title}」的作者请求独立审查。`, href: '/admin/reports',
      })))
      if (reviewers.size === 0 && ownerId) await createNotifications(tx, [{
        recipientUserId: ownerId, sourceKey: `hidden-appeal-assignment:${appeal.id}`,
        type: 'HIDDEN_APPEAL_ASSIGNMENT', title: '下架申诉需要独立审查员',
        summary: '原处理人、发起人和举报人须回避，请授权另一位网站管理员。', href: '/admin/staff',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_HIDDEN') return { error: '该动态并非本人已下架的内容，请刷新后核对。' }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return { error: '这次下架已有申诉，请等待网站处理。' }
    throw error
  }
  revalidatePath(`/projects/${projectId}/updates`)
  revalidatePath('/admin/reports')
  revalidatePath('/notifications')
  return { success: '已提交网站独立复核；原举报人身份不会向您披露。' }
}

export async function decideHiddenUpdateAppealAction(_previous: HiddenAppealState, data: FormData): Promise<HiddenAppealState> {
  const admin = await getCurrentAdmin('REPORT_REVIEW')
  if (!admin) return { error: '您没有独立审查下架申诉的权限。' }
  const id = uuid.safeParse(data.get('appealId'))
  const decision = z.enum(['UPHELD', 'REOPENED']).safeParse(data.get('decision'))
  const reason = z.string().trim().min(10, '请写至少 10 个字处理依据。').max(2000).safeParse(data.get('reason'))
  if (!id.success || !decision.success || !reason.success) return { error: '请核对案件、结论及至少 10 字处理依据。' }
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      const appeal = await tx.projectUpdateRemovalAppeal.findUnique({ where: { id: id.data }, select: {
        id: true, status: true, appellantId: true, originalReviewerId: true, reporterIdSnapshot: true,
        update: { select: { id: true, status: true, reviewedById: true, reviewedAt: true, rejectionReason: true,
          project: { select: { id: true, title: true, creatorId: true } },
          events: { where: { type: 'REOPENED' }, select: { actorUserId: true, previousReviewerIdSnapshot: true } },
        } },
      } })
      if (!appeal || appeal.status !== 'PENDING') throw new Error('ALREADY_REVIEWED')
      if ([appeal.appellantId, appeal.originalReviewerId, appeal.reporterIdSnapshot, appeal.update.project.creatorId].includes(admin.id)) throw new Error('REVIEW_CONFLICT')
      if (appeal.update.status !== 'HIDDEN') throw new Error('STATUS_CHANGED')
      projectId = appeal.update.project.id
      const now = new Date()
      const changed = await tx.projectUpdateRemovalAppeal.updateMany({ where: { id: appeal.id, status: 'PENDING' }, data: {
        status: 'RESOLVED', decision: decision.data, decisionReason: reason.data, reviewedById: admin.id, reviewedAt: now,
      } })
      if (changed.count !== 1) throw new Error('ALREADY_REVIEWED')
      await tx.projectUpdateRemovalAppealEvent.create({ data: { appealId: appeal.id, actorUserId: admin.id, action: decision.data, reason: reason.data } })
      if (decision.data === 'REOPENED') {
        const updated = await tx.projectUpdate.updateMany({ where: { id: appeal.update.id, status: 'HIDDEN' }, data: {
          status: 'PENDING', publishedAt: null, reviewedAt: null, reviewedById: null, rejectionReason: null,
        } })
        if (updated.count !== 1) throw new Error('STATUS_CHANGED')
        await tx.projectUpdateEvent.create({ data: {
          updateId: appeal.update.id, actorUserId: admin.id, type: 'REOPENED', note: reason.data,
          previousStatus: 'HIDDEN', previousReasonSnapshot: appeal.update.rejectionReason,
          previousReviewerIdSnapshot: appeal.update.reviewedById, previousReviewedAtSnapshot: appeal.update.reviewedAt,
        } })
        const earlierReporters = await tx.projectUpdateReport.findMany({ where: { updateId: appeal.update.id, decision: 'CONTENT_REMOVED' },
          select: { reporterId: true } })
        await createNotifications(tx, [...new Set(earlierReporters.map(item => item.reporterId))].map(id => ({
          recipientUserId: id, sourceKey: `appealed-report-correction:${appeal.id}:${id}`,
          type: 'UPDATE_REPORT_CORRECTED', title: '您举报的动态有新的处理进展',
          summary: `项目「${appeal.update.project.title}」的原下架决定已撤销；动态转入重新审核，原举报记录仍保留。`, href: '/reports',
        })))
        const staff = await tx.siteAdmin.findMany({ where: { active: true, permissions: { has: 'PROJECT_REVIEW' } }, select: { userId: true } })
        const reviewers = new Set(staff.map(item => item.userId))
        const ownerId = getSiteOwnerUserId()
        if (ownerId) reviewers.add(ownerId)
        for (const excluded of [appeal.appellantId, appeal.originalReviewerId, appeal.reporterIdSnapshot, appeal.update.project.creatorId, admin.id]) if (excluded) reviewers.delete(excluded)
        for (const previous of appeal.update.events) {
          if (previous.actorUserId) reviewers.delete(previous.actorUserId)
          if (previous.previousReviewerIdSnapshot) reviewers.delete(previous.previousReviewerIdSnapshot)
        }
        await createNotifications(tx, [...reviewers].map(userId => ({
          recipientUserId: userId, sourceKey: `appealed-update-review:${appeal.id}`,
          type: 'PROJECT_UPDATE_SUBMITTED', title: '有纠正后的动态等待重新审核',
          summary: `项目「${appeal.update.project.title}」的下架申诉成立；请独立审核重新发布。`, href: `/admin/updates/${appeal.update.id}`,
        })))
        if (reviewers.size === 0 && ownerId) await createNotifications(tx, [{
          recipientUserId: ownerId, sourceKey: `appealed-update-review-assignment:${appeal.id}`,
          type: 'PROJECT_UPDATE_ASSIGNMENT_NEEDED', title: '重审动态缺少独立审核员',
          summary: '下架申诉已成立，请授权另一位有项目审核权的网站管理员。', href: '/admin/staff',
        }])
      }
      await tx.userNotification.updateMany({ where: { sourceKey: `hidden-update-appeal:${appeal.id}`, readAt: null }, data: { readAt: now } })
      await createNotifications(tx, [{
        recipientUserId: appeal.appellantId, sourceKey: `hidden-appeal-result:${appeal.id}`, type: 'HIDDEN_UPDATE_APPEAL_RESULT',
        title: decision.data === 'REOPENED' ? '动态下架申诉成立' : '动态下架申诉已审结',
        summary: decision.data === 'REOPENED' ? '原下架结论已撤销，动态需要重新审核后才能公开。' : '网站维持下架决定，处理依据留在您的项目动态记录中。',
        href: `/projects/${projectId}/updates`,
      }])
      const ownerId = getSiteOwnerUserId()
      if (ownerId && admin.id !== ownerId) await createNotifications(tx, [{
        recipientUserId: ownerId, sourceKey: `owner-hidden-appeal:${appeal.id}`, type: 'OWNER_HIDDEN_APPEAL_RESULT',
        title: '管理员处理了动态下架申诉', summary: '原下架决定与新的处理结果均保留；涉及项目利益冲突时不可自行裁决。', href: '/admin/reports',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'ALREADY_REVIEWED') return { error: '案件已处理，请刷新页面。' }
    if (error instanceof Error && error.message === 'REVIEW_CONFLICT') return { error: '您是原处理人、项目发起人、作者或举报人，请回避此案。' }
    if (error instanceof Error && error.message === 'STATUS_CHANGED') return { error: '动态状态已经变化，请由站主核对现行记录。' }
    throw error
  }
  revalidatePath('/admin/reports')
  revalidatePath('/admin/moderation')
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/updates`)
  revalidatePath('/notifications')
  return { success: decision.data === 'REOPENED' ? '原下架结论已撤销并留档；动态重新待审。' : '已维持原决定并通知作者。' }
}
