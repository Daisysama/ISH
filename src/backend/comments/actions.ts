'use server'

import { z } from 'zod'
import { getCurrentUser } from '@/backend/auth/current-user'
import { getWritingUser } from '@/backend/auth/write-access'
import { getSiteOwnerUserId } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'
import { commentPermalink } from '@/backend/comments/links'
import { scanProjectText } from '@/core/governance/screening'
import { refreshComments } from '@/backend/comments/refresh'

export type CommentActionState = { error?: string; success?: string }
const uuid = z.string().uuid()
const bodySchema = z.string().trim().min(2, '请至少写 2 个字。').max(1200, '评论或回复最多 1200 字。')

export async function postCommentAction(_previous: CommentActionState, data: FormData): Promise<CommentActionState> {
  const author = await getWritingUser('COMMENTS')
  if (!author) return { error: '请先登录，再参与讨论。' }
  const projectId = uuid.safeParse(data.get('projectId'))
  const updateId = data.get('updateId') ? uuid.safeParse(data.get('updateId')) : null
  const parentId = data.get('parentId') ? uuid.safeParse(data.get('parentId')) : null
  const body = bodySchema.safeParse(data.get('body'))
  if (!projectId.success || updateId?.success === false || parentId?.success === false || !body.success) {
    return { error: !body.success ? body.error.issues[0].message : '讨论链接已失效，请从项目重新进入。' }
  }
  let outcome: 'VISIBLE' | 'PENDING' = 'VISIBLE'
  try {
    await db.$transaction(async tx => {
      const project = await tx.project.findUnique({ where: { id: projectId.data }, select: { status: true, creatorId: true, title: true } })
      if (project?.status !== 'PUBLISHED') throw new Error('NOT_PUBLIC')
      if (updateId?.success) {
        const update = await tx.projectUpdate.findFirst({ where: { id: updateId.data, projectId: projectId.data, status: 'PUBLISHED' }, select: { id: true } })
        if (!update) throw new Error('NOT_PUBLIC')
      }
      if (parentId?.success) await tx.$queryRaw`SELECT id FROM project_comments WHERE id = ${parentId.data} FOR UPDATE`
      const parent = parentId?.success ? await tx.projectComment.findUnique({ where: { id: parentId.data }, select: {
        id: true, authorId: true, projectId: true, updateId: true, parentId: true, status: true,
      } }) : null
      if (parentId && (!parent || parent.status !== 'VISIBLE' || parent.parentId || parent.projectId !== projectId.data ||
        parent.updateId !== (updateId?.success ? updateId.data : null))) throw new Error('PARENT_CHANGED')
      if (parent && parent.authorId !== author.id && await tx.userBlock.count({ where: { active: true, OR: [
        { blockerId: author.id, blockedId: parent.authorId }, { blockerId: parent.authorId, blockedId: author.id },
      ] } })) throw new Error('BLOCKED')
      const today = new Date(); today.setUTCHours(0, 0, 0, 0)
      if (await tx.projectComment.count({ where: { authorId: author.id, createdAt: { gte: today } } }) >= 40) throw new Error('LIMIT')
      const rules = await tx.screeningRule.findMany({ where: { active: true }, select: { id: true, phrase: true, action: true, version: true } })
      const scan = scanProjectText('', body.data, rules)
      const visible = scan.result === 'CLEAR'
      outcome = visible ? 'VISIBLE' : 'PENDING'
      const comment = await tx.projectComment.create({ data: {
        projectId: projectId.data, updateId: updateId?.success ? updateId.data : null, parentId: parent?.id,
        authorId: author.id, authorNameSnapshot: author.displayName, body: body.data,
        status: visible ? 'VISIBLE' : 'PENDING', screeningResult: scan.result, matchedRules: scan.matches,
      } })
      await tx.projectCommentEvent.create({ data: { commentId: comment.id, actorUserId: author.id, action: 'POSTED', bodySnapshot: body.data,
        note: visible ? '未命中网站筛查规则，公开发表。' : '自动筛查暂缓公开，等待网站独立审核。' } })
      if (visible && parent && parent.authorId !== author.id) await createNotifications(tx, [{
        recipientUserId: parent.authorId, sourceKey: `comment-reply:${comment.id}`, type: 'COMMENT_REPLY',
        title: '有人回复了您的评论', summary: `${author.displayName} 在项目「${project.title}」回复了您。`,
        href: commentPermalink(projectId.data, updateId?.success ? updateId.data : null, comment.id),
      }])
      if (visible && !parent && project.creatorId !== author.id) await createNotifications(tx, [{
        recipientUserId: project.creatorId, sourceKey: `comment-project:${comment.id}`, type: 'PROJECT_COMMENT',
        title: '您的项目收到新评论', summary: `${author.displayName} 在项目「${project.title}」参与了讨论。`,
        href: commentPermalink(projectId.data, updateId?.success ? updateId.data : null, comment.id),
      }])
      if (!visible) {
        const staff = await tx.siteAdmin.findMany({ where: { active: true, permissions: { has: 'REPORT_REVIEW' } }, select: { userId: true } })
        const eligible = new Set(staff.map(item => item.userId)); const ownerId = getSiteOwnerUserId()
        if (ownerId) eligible.add(ownerId)
        eligible.delete(author.id); eligible.delete(project.creatorId)
        await createNotifications(tx, [...eligible].map(recipientUserId => ({ recipientUserId,
          sourceKey: `comment-pending:${comment.id}`, type: 'COMMENT_SCREENING_REVIEW', title: '有评论等待内容核查',
          summary: `项目「${project.title}」的一条评论暂缓公开。`, href: '/admin/comments',
        })))
        if (!eligible.size && ownerId) await createNotifications(tx, [{ recipientUserId: ownerId,
          sourceKey: `comment-assignment:${comment.id}`, type: 'REPORT_ASSIGNMENT_NEEDED',
          title: '暂缓评论缺少独立审核员', summary: '请授权与项目发起人和评论作者无利益冲突的管理员。', href: '/admin/staff',
        }])
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_PUBLIC') return { error: '项目或动态已经不公开，请刷新页面。' }
    if (error instanceof Error && error.message === 'PARENT_CHANGED') return { error: '原评论已变化，请刷新后再回复。' }
    if (error instanceof Error && error.message === 'BLOCKED') return { error: '您与对方之间存在用户屏蔽，暂不能互相回复。' }
    if (error instanceof Error && error.message === 'LIMIT') return { error: '今天发表的评论与回复已达上限，请明天继续。' }
    throw error
  }
  refreshComments(projectId.data)
  return { success: outcome === 'VISIBLE' ? '已公开；您可以在下方看到新评论或回复。' : '已提交，命中网站内容规则，暂时仅您可见，独立审核后会收到消息。' }
}

export async function toggleCommentDeletionAction(_previous: CommentActionState, data: FormData): Promise<CommentActionState> {
  const author = await getCurrentUser()
  if (!author) return { error: '请先登录。' }
  const id = uuid.safeParse(data.get('commentId'))
  if (!id.success) return { error: '评论编号无效。' }
  const result = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM project_comments WHERE id = ${id.data} FOR UPDATE`
    const comment = await tx.projectComment.findUnique({ where: { id: id.data }, select: {
      authorId: true, projectId: true, status: true, screeningResult: true, updateId: true,
      project: { select: { status: true } }, update: { select: { status: true } }, parent: { select: { status: true } },
      events: { where: { action: 'SCREENED_VISIBLE' }, take: 1, select: { id: true } },
      reports: { where: { decision: 'AUTHOR_REMOVED' }, select: { reporterId: true } },
    } })
    if (!comment || comment.authorId !== author.id || !['VISIBLE', 'PENDING', 'DELETED'].includes(comment.status)) return null
    const undo = comment.status === 'DELETED'
    const returnToPending = comment.screeningResult !== 'CLEAR' && !comment.events.length || comment.reports.length > 0
    if (undo && (comment.project.status !== 'PUBLISHED' ||
      comment.updateId && comment.update?.status !== 'PUBLISHED' || comment.parent && comment.parent.status !== 'VISIBLE')) return null
    const changed = await tx.projectComment.updateMany({ where: { id: id.data, status: comment.status },
      data: { status: undo ? returnToPending ? 'PENDING' : 'VISIBLE' : 'DELETED' } })
    if (changed.count !== 1) return null
    const event = await tx.projectCommentEvent.create({ data: { commentId: id.data, actorUserId: author.id,
      action: undo ? 'RESTORED_BY_AUTHOR' : 'DELETED_BY_AUTHOR',
      note: undo && comment.reports.length ? '此前待审举报因作者删除而结案，恢复后必须重新独立核查。' : null } })
    if (!undo) {
      const now = new Date()
      await tx.userNotification.updateMany({ where: { sourceKey: `comment-pending:${id.data}`, readAt: null }, data: { readAt: now } })
      await tx.userNotification.updateMany({ where: { sourceKey: { startsWith: `comment-pending-restored:${id.data}:` }, readAt: null }, data: { readAt: now } })
      const pendingReports = await tx.projectCommentReport.findMany({ where: { commentId: id.data, status: 'PENDING' }, select: { id: true, reporterId: true } })
      if (pendingReports.length) {
        await tx.projectCommentReport.updateMany({ where: { id: { in: pendingReports.map(item => item.id) }, status: 'PENDING' }, data: {
          status: 'RESOLVED', decision: 'AUTHOR_REMOVED', decisionReason: '作者主动删除展示；举报内容与原文快照仍保留。', reviewedAt: now,
        } })
        await tx.projectCommentReportEvent.createMany({ data: pendingReports.map(item => ({
          reportId: item.id, actorUserId: author.id, action: 'AUTHOR_REMOVED', note: '作者主动删除，平台未就举报事实作出违规认定。',
        })) })
        await tx.userNotification.updateMany({ where: { sourceKey: { in: pendingReports.map(item => `comment-report:${item.id}`) }, readAt: null }, data: { readAt: now } })
        await createNotifications(tx, pendingReports.map(item => ({ recipientUserId: item.reporterId,
          sourceKey: `comment-report-result:${item.id}`, type: 'COMMENT_REPORT_RESULT', title: '您举报的评论已被作者删除',
          summary: '作者已主动删除展示；网站尚未认定举报事实，原举报保留。', href: '/reports',
        })))
      }
    } else if (returnToPending) {
      const project = await tx.project.findUniqueOrThrow({ where: { id: comment.projectId }, select: { creatorId: true } })
      const staff = await tx.siteAdmin.findMany({ where: { active: true, permissions: { has: 'REPORT_REVIEW' } }, select: { userId: true } })
      const eligible = new Set(staff.map(item => item.userId)); const ownerId = getSiteOwnerUserId()
      if (ownerId) eligible.add(ownerId)
      eligible.delete(author.id); eligible.delete(project.creatorId)
      for (const report of comment.reports) eligible.delete(report.reporterId)
      await createNotifications(tx, [...eligible].map(recipientUserId => ({ recipientUserId,
        sourceKey: `comment-pending-restored:${id.data}:${event.id}`, type: 'COMMENT_SCREENING_REVIEW', title: '评论恢复后仍待独立审核',
        summary: comment.reports.length ? '作者曾在举报待审时删除；恢复不能绕过原内容核查。' : '作者恢复了原内容，请核查后再决定是否公开。',
        href: '/admin/comments',
      })))
      if (!eligible.size && ownerId) await createNotifications(tx, [{ recipientUserId: ownerId,
        sourceKey: `comment-restore-assignment:${event.id}`, type: 'REPORT_ASSIGNMENT_NEEDED',
        title: '恢复的评论缺少独立审核员', summary: '作者、项目发起人、历史举报人必须回避，请另行授权。', href: '/admin/staff',
      }])
    }
    return { projectId: comment.projectId, undo }
  })
  if (!result) return { error: '无法修改这条记录：仅作者可撤销自己的删除；经网站下架的评论需走独立申诉。' }
  refreshComments(result.projectId)
  return { success: result.undo ? '原评论或回复已恢复；此前等待审核的内容仍需审核后才公开。' : '已删除展示，原记录保留；您可在原位置撤销删除。' }
}

export async function setCommentPreferenceAction(_previous: CommentActionState, data: FormData): Promise<CommentActionState> {
  const user = await getCurrentUser()
  if (!user) return { error: '请先登录。' }
  const id = uuid.safeParse(data.get('commentId'))
  const operation = z.enum(['LIKE', 'DISLIKE', 'HIDE', 'SHOW']).safeParse(data.get('operation'))
  if (!id.success || !operation.success) return { error: '操作已失效，请刷新。' }
  const projectId = await db.$transaction(async tx => {
    const comment = await tx.projectComment.findUnique({ where: { id: id.data }, select: { authorId: true, projectId: true, status: true } })
    if (!comment || comment.status !== 'VISIBLE' || comment.authorId === user.id) return null
    const old = await tx.projectCommentPreference.findUnique({ where: { commentId_userId: { commentId: id.data, userId: user.id } } })
    const reaction = operation.data === 'LIKE' || operation.data === 'DISLIKE'
      ? old?.reaction === operation.data ? null : operation.data : old?.reaction ?? null
    const hidden = operation.data === 'HIDE' ? true : operation.data === 'SHOW' || operation.data === 'LIKE' ? false
      : operation.data === 'DISLIKE' ? reaction === 'DISLIKE' : old?.hidden ?? false
    if (old?.reaction === reaction && (old?.hidden ?? false) === hidden) return null
    await tx.projectCommentPreference.upsert({ where: { commentId_userId: { commentId: id.data, userId: user.id } },
      create: { commentId: id.data, userId: user.id, reaction, hidden }, update: { reaction, hidden } })
    await tx.projectCommentEvent.create({ data: { commentId: id.data, actorUserId: user.id,
      action: 'PREFERENCE_CHANGED', note: `本人表态：${reaction === 'LIKE' ? '点赞' : reaction === 'DISLIKE' ? '点踩' : '无'}；私人屏蔽：${hidden ? '是' : '否'}` } })
    return comment.projectId
  })
  if (!projectId) return { error: '评论已变化，或不能给自己表态；请刷新。' }
  refreshComments(projectId)
  return { success: '已更新个人表态与屏蔽，可随时撤销。点踩不会替别人隐藏内容。' }
}
