'use server'

import { z } from 'zod'
import { getCurrentUser } from '@/backend/auth/current-user'
import { getCurrentAdmin, getSiteOwnerUserId, isSiteOwner } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'
import { refreshComments } from '@/backend/comments/refresh'
import type { CommentGovernanceState } from '@/backend/comments/governance'

const uuid = z.string().uuid()
const explanation = z.string().trim().min(10, '请至少写 10 字说明依据。').max(2000)

export async function appealHiddenCommentAction(_previous: CommentGovernanceState, data: FormData): Promise<CommentGovernanceState> {
  const author = await getCurrentUser()
  if (!author) return { error: '请登录后申诉自己的评论。' }
  const id = uuid.safeParse(data.get('commentId'))
  const statement = explanation.safeParse(data.get('statement'))
  if (!id.success || !statement.success) return { error: '请核对评论编号和至少 10 字申诉说明。' }
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM project_comments WHERE id = ${id.data} FOR UPDATE`
      const comment = await tx.projectComment.findUnique({ where: { id: id.data }, select: { id: true, projectId: true, authorId: true,
        status: true, hiddenReason: true, hiddenById: true, project: { select: { creatorId: true, title: true } },
        reports: { where: { status: 'RESOLVED', decision: 'HIDDEN' }, orderBy: { reviewedAt: 'asc' },
          select: { id: true, reporterId: true } }, appeal: { select: { id: true } },
      } })
      if (!comment || comment.authorId !== author.id || comment.status !== 'HIDDEN' || comment.appeal) throw new Error('STALE')
      projectId = comment.projectId
      const source = comment.reports[0]
      const appeal = await tx.projectCommentAppeal.create({ data: {
        commentId: comment.id, reportId: source?.id, appellantId: author.id, originalReviewerId: comment.hiddenById,
        reporterIdSnapshot: source?.reporterId, reasonSnapshot: comment.hiddenReason ?? '原处理原因未记录', statement: statement.data,
      } })
      await tx.projectCommentAppealEvent.create({ data: { appealId: appeal.id, actorUserId: author.id, action: 'SUBMITTED', note: statement.data } })
      const staff = await tx.siteAdmin.findMany({ where: { active: true, permissions: { has: 'REPORT_REVIEW' } }, select: { userId: true } })
      const eligible = new Set(staff.map(item => item.userId)); const ownerId = getSiteOwnerUserId()
      if (ownerId) eligible.add(ownerId)
      for (const excluded of [author.id, comment.project.creatorId, comment.hiddenById,
        ...comment.reports.map(item => item.reporterId)]) if (excluded) eligible.delete(excluded)
      await createNotifications(tx, [...eligible].map(recipientUserId => ({ recipientUserId,
        sourceKey: `comment-appeal:${appeal.id}`, type: 'COMMENT_APPEAL', title: '有评论下架申诉待独立复核',
        summary: `项目「${comment.project.title}」的一条评论提出申诉。`, href: '/admin/comments',
      })))
      if (!eligible.size && ownerId) await createNotifications(tx, [{ recipientUserId: ownerId,
        sourceKey: `comment-appeal-assignment:${appeal.id}`, type: 'REPORT_ASSIGNMENT_NEEDED',
        title: '评论申诉缺少独立审核员', summary: '请授权与原审、作者、举报人和项目发起人无关的管理员。', href: '/admin/staff',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE') return { error: '该评论已恢复、申诉过或状态变化，请刷新。' }
    throw error
  }
  refreshComments(projectId)
  return { success: '申诉已提交独立网站审核员，原处理人不能审自己的决定。' }
}

export async function decideCommentAppealAction(_previous: CommentGovernanceState, data: FormData): Promise<CommentGovernanceState> {
  const admin = await getCurrentAdmin('REPORT_REVIEW')
  if (!admin) return { error: '没有申诉审查权限。' }
  const id = uuid.safeParse(data.get('appealId'))
  const decision = z.enum(['UPHELD', 'REOPENED']).safeParse(data.get('decision'))
  const reason = explanation.safeParse(data.get('reason'))
  if (!id.success || !decision.success || !reason.success) return { error: '请核对案件、结论及至少 10 字依据。' }
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      const source = await tx.projectCommentAppeal.findUnique({ where: { id: id.data }, select: { commentId: true } })
      if (!source) throw new Error('STALE')
      await tx.$queryRaw`SELECT id FROM project_comments WHERE id = ${source.commentId} FOR UPDATE`
      const appeal = await tx.projectCommentAppeal.findUnique({ where: { id: id.data }, select: {
        id: true, status: true, appellantId: true, originalReviewerId: true, reporterIdSnapshot: true,
        comment: { select: { id: true, projectId: true, updateId: true, authorId: true, status: true,
          project: { select: { creatorId: true, status: true, title: true } }, update: { select: { status: true } },
          parent: { select: { status: true } }, reports: { select: { reporterId: true } },
        } },
      } })
      if (!appeal || appeal.status !== 'PENDING' || appeal.comment.status !== 'HIDDEN') throw new Error('STALE')
      if ([appeal.appellantId, appeal.originalReviewerId, appeal.reporterIdSnapshot,
        appeal.comment.project.creatorId, ...appeal.comment.reports.map(item => item.reporterId)].includes(admin.id)) throw new Error('CONFLICT')
      if (decision.data === 'REOPENED' && (appeal.comment.project.status !== 'PUBLISHED' ||
        appeal.comment.updateId && appeal.comment.update?.status !== 'PUBLISHED' ||
        appeal.comment.parent && appeal.comment.parent.status !== 'VISIBLE')) throw new Error('NOT_PUBLIC')
      projectId = appeal.comment.projectId
      const now = new Date()
      await tx.projectCommentAppeal.update({ where: { id: appeal.id }, data: { status: 'RESOLVED', decision: decision.data,
        decisionReason: reason.data, reviewedById: admin.id, reviewedAt: now } })
      await tx.projectCommentAppealEvent.create({ data: { appealId: appeal.id, actorUserId: admin.id, action: decision.data, note: reason.data } })
      if (decision.data === 'REOPENED') {
        await tx.projectComment.update({ where: { id: appeal.comment.id }, data: { status: 'VISIBLE', hiddenReason: null, hiddenById: null } })
        await tx.projectCommentEvent.create({ data: { commentId: appeal.comment.id, actorUserId: admin.id, action: 'RESTORED_AFTER_APPEAL', note: reason.data } })
      }
      await tx.userNotification.updateMany({ where: { sourceKey: `comment-appeal:${appeal.id}`, readAt: null }, data: { readAt: now } })
      const href = `/projects/${projectId}/discussion${appeal.comment.updateId ? `?update=${appeal.comment.updateId}` : ''}`
      await createNotifications(tx, [{ recipientUserId: appeal.appellantId,
        sourceKey: `comment-appeal-result:${appeal.id}`, type: 'COMMENT_APPEAL_RESULT', title: '评论申诉已有结论',
        summary: `项目「${appeal.comment.project.title}」的评论${decision.data === 'REOPENED' ? '已恢复公开' : '维持下架'}，处理依据保留。`, href,
      }])
      if (decision.data === 'REOPENED' && appeal.reporterIdSnapshot) await createNotifications(tx, [{
        recipientUserId: appeal.reporterIdSnapshot, sourceKey: `comment-appeal-reporter:${appeal.id}`,
        type: 'COMMENT_REPORT_CORRECTED', title: '您举报的评论处理结果已更正', summary: '原下架决定已撤销，您可在我的举报查看。', href: '/reports',
      }])
      const ownerId = getSiteOwnerUserId()
      if (ownerId && admin.id !== ownerId) await createNotifications(tx, [{ recipientUserId: ownerId,
        sourceKey: `owner-comment-appeal:${appeal.id}`, type: 'OWNER_COMMENT_DECISION', title: '管理员处理了评论申诉',
        summary: '原结论与复核理由已分别留档。', href: '/admin/comments',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE') return { error: '案件或评论状态已变化，请刷新。' }
    if (error instanceof Error && error.message === 'CONFLICT') return { error: '原审、作者、举报人和项目发起人必须回避。' }
    if (error instanceof Error && error.message === 'NOT_PUBLIC') return { error: '项目或动态已下架，暂不能恢复评论公开。' }
    throw error
  }
  refreshComments(projectId)
  return { success: '申诉结论、旧决定和通知均已保存。' }
}

/** 站主可直接纠正其他管理员的评论下架，不能审自己的案子。 */
export async function ownerRestoreCommentAction(_previous: CommentGovernanceState, data: FormData): Promise<CommentGovernanceState> {
  const owner = await getCurrentUser()
  if (!owner || !isSiteOwner(owner.id)) return { error: '仅站主可直接纠正管理员操作。' }
  const id = uuid.safeParse(data.get('commentId'))
  const reason = explanation.safeParse(data.get('reason'))
  if (!id.success || !reason.success) return { error: '请核对评论并写至少 10 字纠错理由。' }
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM project_comments WHERE id = ${id.data} FOR UPDATE`
      const comment = await tx.projectComment.findUnique({ where: { id: id.data }, select: { id: true, projectId: true, updateId: true,
        authorId: true, status: true, hiddenById: true, project: { select: { creatorId: true, status: true } },
        update: { select: { status: true } }, parent: { select: { status: true } }, appeal: { select: { id: true, status: true } },
        reports: { where: { decision: 'HIDDEN' }, select: { reporterId: true } },
      } })
      if (!comment || comment.status !== 'HIDDEN' || comment.project.status !== 'PUBLISHED' ||
        comment.updateId && comment.update?.status !== 'PUBLISHED' || comment.parent && comment.parent.status !== 'VISIBLE') throw new Error('STALE')
      if ([comment.authorId, comment.project.creatorId, comment.hiddenById,
        ...comment.reports.map(item => item.reporterId)].includes(owner.id)) throw new Error('CONFLICT')
      projectId = comment.projectId
      await tx.projectComment.update({ where: { id: comment.id }, data: { status: 'VISIBLE', hiddenReason: null, hiddenById: null } })
      await tx.projectCommentEvent.create({ data: { commentId: comment.id, actorUserId: owner.id, action: 'OWNER_RESTORED', note: reason.data } })
      if (comment.appeal?.status === 'PENDING') {
        await tx.projectCommentAppeal.update({ where: { id: comment.appeal.id }, data: {
          status: 'RESOLVED', decision: 'REOPENED', decisionReason: `站主纠正：${reason.data}`, reviewedById: owner.id, reviewedAt: new Date(),
        } })
        await tx.projectCommentAppealEvent.create({ data: { appealId: comment.appeal.id, actorUserId: owner.id,
          action: 'OWNER_RESTORED', note: reason.data } })
        await tx.userNotification.updateMany({ where: { sourceKey: `comment-appeal:${comment.appeal.id}`, readAt: null }, data: { readAt: new Date() } })
      }
      const affected = new Set([comment.authorId, comment.hiddenById, ...comment.reports.map(item => item.reporterId)])
      affected.delete(owner.id)
      await createNotifications(tx, [...affected].filter((value): value is string => Boolean(value)).map(recipientUserId => ({
        recipientUserId, sourceKey: `owner-comment-restored:${comment.id}:${recipientUserId}`, type: 'COMMENT_REPORT_CORRECTED',
        title: '站主纠正了一次评论下架', summary: '原决定和纠错理由均已留档。',
        href: recipientUserId === comment.authorId ? `/projects/${projectId}/discussion${comment.updateId ? `?update=${comment.updateId}` : ''}` : '/reports',
      })))
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE') return { error: '项目或评论状态已变化，请刷新。' }
    if (error instanceof Error && error.message === 'CONFLICT') return { error: '站主与案件有关，须交独立网站管理员处理。' }
    throw error
  }
  refreshComments(projectId)
  return { success: '评论已恢复，原处分、撤销理由和当事人提醒均留存。' }
}
