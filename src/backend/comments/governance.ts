'use server'

import { z } from 'zod'
import { getCurrentUser } from '@/backend/auth/current-user'
import { getCurrentAdmin, getSiteOwnerUserId, isSiteOwner } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'
import { commentPermalink } from '@/backend/comments/links'
import { refreshComments } from '@/backend/comments/refresh'

export type CommentGovernanceState = { error?: string; success?: string }
const uuid = z.string().uuid()
const reason = z.string().trim().min(10, '请写至少 10 个字说明事实。').max(2000)
const categories = z.enum(['HARASSMENT', 'MISLEADING', 'RIGHTS', 'CONTENT', 'OTHER'])

export async function reportCommentAction(_previous: CommentGovernanceState, data: FormData): Promise<CommentGovernanceState> {
  const reporter = await getCurrentUser()
  if (!reporter) return { error: '请登录后举报。' }
  const id = uuid.safeParse(data.get('commentId'))
  const statement = reason.safeParse(data.get('statement'))
  const category = categories.safeParse(data.get('category'))
  if (!id.success || !statement.success || !category.success) return { error: statement.success ? '请核对评论与问题类型。' : statement.error.issues[0].message }
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM project_comments WHERE id = ${id.data} FOR UPDATE`
      const comment = await tx.projectComment.findUnique({ where: { id: id.data }, select: { id: true, projectId: true, authorId: true, body: true,
        status: true, project: { select: { creatorId: true, title: true, status: true } }, update: { select: { status: true } }, updateId: true,
      } })
      if (!comment || comment.status !== 'VISIBLE' || comment.project.status !== 'PUBLISHED' ||
        comment.updateId && comment.update?.status !== 'PUBLISHED') throw new Error('STALE')
      if (comment.authorId === reporter.id) throw new Error('SELF')
      if (await tx.projectCommentReport.count({ where: { reporterId: reporter.id, status: { not: 'WITHDRAWN' }, commentId: id.data } })) throw new Error('DUPLICATE')
      const today = new Date(); today.setUTCHours(0, 0, 0, 0)
      if (await tx.projectCommentReport.count({ where: { reporterId: reporter.id, createdAt: { gte: today } } }) >= 10) throw new Error('LIMIT')
      projectId = comment.projectId
      const report = await tx.projectCommentReport.create({ data: { commentId: comment.id, reporterId: reporter.id,
        category: category.data, statement: statement.data, bodySnapshot: comment.body } })
      await tx.projectCommentReportEvent.create({ data: { reportId: report.id, actorUserId: reporter.id, action: 'SUBMITTED' } })
      const staff = await tx.siteAdmin.findMany({ where: { active: true, permissions: { has: 'REPORT_REVIEW' } }, select: { userId: true } })
      const eligible = new Set(staff.map(item => item.userId)); const ownerId = getSiteOwnerUserId()
      if (ownerId) eligible.add(ownerId)
      eligible.delete(reporter.id); eligible.delete(comment.authorId); eligible.delete(comment.project.creatorId)
      await createNotifications(tx, [...eligible].map(recipientUserId => ({ recipientUserId,
        sourceKey: `comment-report:${report.id}`, type: 'COMMENT_REPORT', title: '有公开评论被举报',
        summary: `项目「${comment.project.title}」的一条评论待独立审查。`, href: '/admin/comments',
      })))
      if (!eligible.size && ownerId) await createNotifications(tx, [{ recipientUserId: ownerId,
        sourceKey: `comment-report-assignment:${report.id}`, type: 'REPORT_ASSIGNMENT_NEEDED',
        title: '评论举报缺少独立审核员', summary: '被举报者、举报人和项目发起人不能裁决本案。', href: '/admin/staff',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE') return { error: '这条评论已不公开，请刷新。' }
    if (error instanceof Error && error.message === 'SELF') return { error: '无法举报自己发表的内容；您可以删除它。' }
    if (error instanceof Error && error.message === 'DUPLICATE') return { error: '您已举报过这条内容；待处理时可先撤回再重写。' }
    if (error instanceof Error && error.message === 'LIMIT') return { error: '今天的评论举报达到上限，请明天再试。' }
    throw error
  }
  refreshComments(projectId)
  return { success: '已收到举报。举报人说明仅供独立网站审核员核查；审核前可以撤回。' }
}

export async function withdrawCommentReportAction(_previous: CommentGovernanceState, data: FormData): Promise<CommentGovernanceState> {
  const reporter = await getCurrentUser()
  if (!reporter) return { error: '请先登录。' }
  const id = uuid.safeParse(data.get('reportId'))
  if (!id.success) return { error: '举报记录无效。' }
  const projectId = await db.$transaction(async tx => {
    const report = await tx.projectCommentReport.findUnique({ where: { id: id.data }, select: {
      reporterId: true, status: true, retractedAt: true, decision: true,
      comment: { select: { projectId: true, updateId: true, authorId: true, project: { select: { title: true } } } },
    } })
    if (!report || report.reporterId !== reporter.id || report.status === 'WITHDRAWN' || report.retractedAt) return null
    const alreadyDecided = report.status === 'RESOLVED'
    const changed = await tx.projectCommentReport.updateMany({ where: { id: id.data, status: report.status, retractedAt: null },
      data: alreadyDecided ? { retractedAt: new Date() } : { status: 'WITHDRAWN' } })
    if (!changed.count) return null
    await tx.projectCommentReportEvent.create({ data: { reportId: id.data, actorUserId: reporter.id,
      action: alreadyDecided ? 'RETRACTED_AFTER_DECISION' : 'WITHDRAWN', note: '举报人自行撤回原陈述；历史内容与独立裁决均保留。' } })
    await tx.userNotification.updateMany({ where: { sourceKey: `comment-report:${id.data}`, readAt: null }, data: { readAt: new Date() } })
    if (alreadyDecided) {
      const ownerId = getSiteOwnerUserId()
      const recipients = new Set([report.comment.authorId, ownerId].filter((value): value is string => Boolean(value)))
      recipients.delete(reporter.id)
      await createNotifications(tx, [...recipients].map(recipientUserId => ({ recipientUserId,
        sourceKey: `comment-report-retracted:${id.data}`, type: 'COMMENT_REPORT_RETRACTED', title: '一条已处理评论举报被撤回',
        summary: `项目「${report.comment.project.title}」的举报人撤回原陈述；原裁决并未自动撤销，请核对记录。`,
        href: recipientUserId === ownerId ? '/admin/comments' : `/projects/${report.comment.projectId}/discussion${report.comment.updateId ? `?update=${report.comment.updateId}` : ''}`,
      })))
    }
    return report.comment.projectId
  })
  if (!projectId) return { error: '举报不属于您或已撤回，请刷新。' }
  refreshComments(projectId)
  return { success: '原举报已撤回并保留历史；如网站已经作出裁决，该裁决仍需网站独立纠错，不会随举报自动失效。' }
}

/** 自动筛查暂缓的评论由与作者、项目发起人无关的审核员复核。 */
export async function decideScreenedCommentAction(_previous: CommentGovernanceState, data: FormData): Promise<CommentGovernanceState> {
  const admin = await getCurrentAdmin('REPORT_REVIEW')
  if (!admin) return { error: '没有网站评论审核权限。' }
  const id = uuid.safeParse(data.get('commentId'))
  const decision = z.enum(['VISIBLE', 'HIDDEN']).safeParse(data.get('decision'))
  const explanation = reason.safeParse(data.get('reason'))
  if (!id.success || !decision.success || !explanation.success) return { error: '请核对评论、结论与至少 10 字依据。' }
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM project_comments WHERE id = ${id.data} FOR UPDATE`
      const item = await tx.projectComment.findUnique({ where: { id: id.data }, select: { id: true, projectId: true, updateId: true, parentId: true, status: true,
        authorId: true, project: { select: { creatorId: true, title: true, status: true } }, update: { select: { status: true } },
        parent: { select: { status: true, authorId: true } },
        reports: { select: { reporterId: true } },
      } })
      if (!item || item.status !== 'PENDING') throw new Error('STALE')
      if ([item.authorId, item.project.creatorId, ...item.reports.map(report => report.reporterId)].includes(admin.id)) throw new Error('CONFLICT')
      if (decision.data === 'VISIBLE' && (item.project.status !== 'PUBLISHED' || item.updateId && item.update?.status !== 'PUBLISHED' ||
        item.parentId && item.parent?.status !== 'VISIBLE')) throw new Error('NOT_PUBLIC')
      projectId = item.projectId
      await tx.projectComment.update({ where: { id: item.id }, data: { status: decision.data,
        hiddenById: decision.data === 'HIDDEN' ? admin.id : null, hiddenReason: decision.data === 'HIDDEN' ? explanation.data : null } })
      await tx.projectCommentEvent.create({ data: { commentId: item.id, actorUserId: admin.id, action: `SCREENED_${decision.data}`, note: explanation.data } })
      await tx.userNotification.updateMany({ where: { sourceKey: `comment-pending:${item.id}`, readAt: null }, data: { readAt: new Date() } })
      const href = `/projects/${item.projectId}/discussion${item.updateId ? `?update=${item.updateId}` : ''}`
      await createNotifications(tx, [{ recipientUserId: item.authorId, sourceKey: `comment-screened:${item.id}`,
        type: 'COMMENT_SCREENING_RESULT', title: decision.data === 'VISIBLE' ? '您的评论已公开' : '您的评论被网站暂缓公开',
        summary: `项目「${item.project.title}」中的审核结论和原依据保留在评论处。`, href,
      }])
      if (decision.data === 'VISIBLE' && item.parent?.authorId && item.parent.authorId !== item.authorId) await createNotifications(tx, [{
        recipientUserId: item.parent.authorId, sourceKey: `comment-reply:${item.id}`, type: 'COMMENT_REPLY',
        title: '有人回复了您的评论', summary: `项目「${item.project.title}」有新回复。`, href: commentPermalink(projectId, item.updateId, item.id),
      }])
      if (decision.data === 'VISIBLE' && !item.parentId && item.project.creatorId !== item.authorId) await createNotifications(tx, [{
        recipientUserId: item.project.creatorId, sourceKey: `comment-project:${item.id}`, type: 'PROJECT_COMMENT',
        title: '您的项目收到新评论', summary: `项目「${item.project.title}」有一条新讨论。`, href: commentPermalink(projectId, item.updateId, item.id),
      }])
      const ownerId = getSiteOwnerUserId()
      if (ownerId && ownerId !== admin.id) await createNotifications(tx, [{ recipientUserId: ownerId,
        sourceKey: `owner-comment-screened:${item.id}`, type: 'OWNER_COMMENT_DECISION', title: '管理员审核了一条评论',
        summary: `项目「${item.project.title}」的评论有新处理结果与依据。`, href: '/admin/comments',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE') return { error: '评论已处理，请刷新。' }
    if (error instanceof Error && error.message === 'CONFLICT') return { error: '评论作者或项目发起人必须回避。' }
    if (error instanceof Error && error.message === 'NOT_PUBLIC') return { error: '项目、动态或原评论已不公开，不能放行这条回复。' }
    throw error
  }
  refreshComments(projectId)
  return { success: '审核结论已留痕，评论作者与站主已收到消息。' }
}

export async function decideCommentReportAction(_previous: CommentGovernanceState, data: FormData): Promise<CommentGovernanceState> {
  const admin = await getCurrentAdmin('REPORT_REVIEW')
  if (!admin) return { error: '没有独立举报审查权限。' }
  const id = uuid.safeParse(data.get('reportId'))
  const decision = z.enum(['NO_VIOLATION', 'HIDDEN']).safeParse(data.get('decision'))
  const explanation = reason.safeParse(data.get('reason'))
  if (!id.success || !decision.success || !explanation.success) return { error: '请核对案件、处理结论和至少 10 字依据。' }
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      const source = await tx.projectCommentReport.findUnique({ where: { id: id.data }, select: { commentId: true } })
      if (!source) throw new Error('STALE')
      await tx.$queryRaw`SELECT id FROM project_comments WHERE id = ${source.commentId} FOR UPDATE`
      const report = await tx.projectCommentReport.findUnique({ where: { id: id.data }, select: { id: true, status: true, reporterId: true,
        comment: { select: { id: true, authorId: true, projectId: true, updateId: true, status: true,
          project: { select: { creatorId: true, title: true } },
          reports: { select: { reporterId: true } } } },
      } })
      if (!report || report.status !== 'PENDING' || report.comment.status !== 'VISIBLE') throw new Error('STALE')
      if ([report.comment.authorId, report.comment.project.creatorId,
        ...report.comment.reports.map(item => item.reporterId)].includes(admin.id)) throw new Error('CONFLICT')
      projectId = report.comment.projectId
      const now = new Date()
      await tx.projectCommentReport.update({ where: { id: report.id }, data: { status: 'RESOLVED', decision: decision.data,
        decisionReason: explanation.data, reviewedById: admin.id, reviewedAt: now } })
      await tx.projectCommentReportEvent.create({ data: { reportId: report.id, actorUserId: admin.id, action: decision.data, note: explanation.data } })
      const href = `/projects/${projectId}/discussion${report.comment.updateId ? `?update=${report.comment.updateId}` : ''}`
      if (decision.data === 'HIDDEN') {
        await tx.projectComment.update({ where: { id: report.comment.id }, data: { status: 'HIDDEN', hiddenById: admin.id, hiddenReason: explanation.data } })
        await tx.projectCommentEvent.create({ data: { commentId: report.comment.id, actorUserId: admin.id, action: 'HIDDEN_AFTER_REPORT', note: explanation.data } })
        const duplicates = await tx.projectCommentReport.findMany({ where: { commentId: report.comment.id, status: 'PENDING' }, select: { id: true, reporterId: true } })
        for (const item of duplicates) {
          await tx.projectCommentReport.update({ where: { id: item.id }, data: { status: 'RESOLVED', decision: 'HIDDEN',
            decisionReason: `并入同一评论核查：${explanation.data}`, reviewedById: admin.id, reviewedAt: now } })
          await tx.projectCommentReportEvent.create({ data: { reportId: item.id, actorUserId: admin.id, action: 'MERGED', note: explanation.data } })
        }
        await createNotifications(tx, duplicates.map(item => ({ recipientUserId: item.reporterId,
          sourceKey: `comment-report-result:${item.id}`, type: 'COMMENT_REPORT_RESULT', title: '评论举报已有处理结果',
          summary: `项目「${report.comment.project.title}」相关评论已暂缓公开。`, href: '/reports',
        })))
        await tx.userNotification.updateMany({ where: { sourceKey: { in: duplicates.map(item => `comment-report:${item.id}`) }, readAt: null }, data: { readAt: now } })
        await createNotifications(tx, [{ recipientUserId: report.comment.authorId, sourceKey: `comment-hidden:${report.id}`,
          type: 'COMMENT_HIDDEN', title: '您的评论经举报核查后下架', summary: '原处理依据和独立申诉入口保留在您的评论处。', href,
        }])
      }
      await tx.userNotification.updateMany({ where: { sourceKey: `comment-report:${report.id}`, readAt: null }, data: { readAt: now } })
      await createNotifications(tx, [{ recipientUserId: report.reporterId, sourceKey: `comment-report-result:${report.id}`,
        type: 'COMMENT_REPORT_RESULT', title: '评论举报已有处理结果', summary: `项目「${report.comment.project.title}」：${decision.data === 'HIDDEN' ? '相关评论已下架' : '核查后维持公开'}。`, href: '/reports',
      }])
      const ownerId = getSiteOwnerUserId()
      if (ownerId && ownerId !== admin.id) await createNotifications(tx, [{ recipientUserId: ownerId,
        sourceKey: `owner-comment-report:${report.id}`, type: 'OWNER_COMMENT_DECISION', title: '管理员处理了评论举报',
        summary: `项目「${report.comment.project.title}」的原始结论与依据已留档。`, href: '/admin/comments',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE') return { error: '举报或评论状态已经变化，请刷新。' }
    if (error instanceof Error && error.message === 'CONFLICT') return { error: '举报人、作者、项目发起人不能裁决此案。' }
    throw error
  }
  refreshComments(projectId)
  return { success: '已保存独立审核结果，并通知相关用户和站主。' }
}
