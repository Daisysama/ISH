'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getCurrentAdmin, getSiteOwnerUserId, isSiteOwner } from '@/backend/auth/admin'
import { getCurrentUser } from '@/backend/auth/current-user'
import { getWritingUser } from '@/backend/auth/write-access'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'
import { notifyProjectFavorites } from '@/backend/updates/favorite-notices'
import { scanProjectText } from '@/core/governance/screening'
import { projectUpdateRejectionSchema, projectUpdateSchema } from '@/core/updates/project-update'

export type UpdateFormState = { error?: string; field?: 'title' | 'body'; success?: string }
const uuid = z.string().uuid()

function refresh(projectId: string) {
  revalidatePath('/admin/moderation')
  revalidatePath('/dashboard')
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/updates`)
  revalidatePath('/notifications')
}

export async function submitProjectUpdateAction(_previous: UpdateFormState, formData: FormData): Promise<UpdateFormState> {
  const author = await getWritingUser('PROJECTS')
  if (!author) redirect('/login')
  const projectId = uuid.safeParse(formData.get('projectId'))
  if (!projectId.success) return { error: '项目链接已失效，请从我的项目重新进入。' }
  const parsed = projectUpdateSchema.safeParse({ title: formData.get('title'), body: formData.get('body') })
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, field: first.path[0] as UpdateFormState['field'] }
  }
  let screeningResult: 'CLEAR' | 'REVIEW' | 'BLOCK' | 'PUBLISHED' = 'CLEAR'
  try {
    screeningResult = await db.$transaction(async tx => {
      const project = await tx.project.findUnique({
        where: { id: projectId.data },
        select: { id: true, title: true, status: true, creatorId: true },
      })
      if (!project || project.status !== 'PUBLISHED') throw new Error('PROJECT_NOT_PUBLISHED')
      if (project.creatorId !== author.id) {
        const membership = await tx.projectMembership.findUnique({
          where: { projectId_userId: { projectId: project.id, userId: author.id } },
          select: { status: true, permissions: true },
        })
        if (membership?.status !== 'ACTIVE' || !membership.permissions.includes('SUBMIT_UPDATES')) throw new Error('NO_MEMBER_PERMISSION')
      }
      const rules = await tx.screeningRule.findMany({ where: { active: true }, select: { id: true, phrase: true, action: true, version: true } })
      const scan = scanProjectText(parsed.data.title, parsed.data.body, rules)
      const policy = scan.result === 'CLEAR' ? await tx.contentScreeningPolicy.findUnique({ where: { id: 'site' },
        include: { events: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } },
      }) : null
      const autoPublish = scan.result === 'CLEAR' && Boolean(policy?.autoApproveClearUpdates)
      const publishedAt = autoPublish ? new Date() : null
      const update = await tx.projectUpdate.create({
        data: {
          projectId: project.id, authorId: author.id, authorNameSnapshot: author.displayName,
          title: parsed.data.title, body: parsed.data.body,
          status: scan.result === 'BLOCK' ? 'REJECTED' : autoPublish ? 'PUBLISHED' : 'PENDING',
          publishedAt, reviewedAt: publishedAt,
          rejectionReason: scan.result === 'BLOCK' ? '系统筛查暂缓发布。您可以调整内容重新提交，或申请由网站管理员人工复核。' : null,
        },
      })
      await tx.projectUpdateScan.create({
        data: { updateId: update.id, result: scan.result, textHash: scan.textHash, matchedRules: scan.matches },
      })
      await tx.projectUpdateEvent.create({ data: { updateId: update.id, actorUserId: author.id, type: 'SUBMITTED' } })
      if (autoPublish) await tx.projectUpdateEvent.create({ data: {
        updateId: update.id, actorUserId: getSiteOwnerUserId(), type: 'AUTO_APPROVED',
        note: `未命中当前规则，依据站主设置自动公开；策略变更记录 ${policy?.events[0]?.id ?? '请查阅内容规则历史'}。`,
      } })
      if (autoPublish) await notifyProjectFavorites(tx, project.id, project.title, update.id, update.title, author.id)
      if (scan.result === 'BLOCK') {
        await tx.projectUpdateEvent.create({ data: { updateId: update.id, type: 'REJECTED', note: '自动规则暂缓发布；作者可申请人工复核。' } })
      }
      if (scan.result !== 'BLOCK' && !autoPublish) {
      const staff = await tx.siteAdmin.findMany({
        where: { active: true, permissions: { has: 'PROJECT_REVIEW' } }, select: { userId: true },
      })
      const eligible = new Set(staff.map(item => item.userId))
      const siteOwnerId = getSiteOwnerUserId()
      if (siteOwnerId) eligible.add(siteOwnerId)
      eligible.delete(project.creatorId)
      eligible.delete(author.id)
      await createNotifications(tx, [...eligible].map(id => ({
        recipientUserId: id, sourceKey: `update-review:${update.id}`, type: 'PROJECT_UPDATE_SUBMITTED',
        title: '有新项目动态待审核', summary: `项目「${project.title}」提交了动态。`,
        href: `/admin/updates/${update.id}`,
      })))
      if (eligible.size === 0 && siteOwnerId) {
        await createNotifications(tx, [{
          recipientUserId: siteOwnerId, sourceKey: `update-reviewer-needed:${update.id}`,
          type: 'PROJECT_UPDATE_ASSIGNMENT_NEEDED', title: '项目动态需要独立审核员',
          summary: '发起人和作者不能审核自己的动态；请授权另一位网站管理员。', href: '/admin/staff',
        }])
      }
      }
      if (project.creatorId !== author.id) {
        await createNotifications(tx, [{
          recipientUserId: project.creatorId, sourceKey: `update-submitted:${update.id}`,
          type: 'TEAM_UPDATE_SUBMITTED', title: '同行者提交了项目动态',
          summary: `${author.displayName} 为项目「${project.title}」提交了动态，${scan.result === 'BLOCK' ? '系统暂缓了发布，可由作者申请人工复核。' : autoPublish ? '按站主规则设置已自动公开。' : '审核通过后才会公开。'}`,
          href: `/projects/${project.id}/updates`,
        }])
      }
      return autoPublish ? 'PUBLISHED' : scan.result
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'PROJECT_NOT_PUBLISHED') return { error: '只有已发布项目可以发对外动态。' }
    if (error instanceof Error && error.message === 'NO_MEMBER_PERMISSION') return { error: '您尚未获得提交动态的权限，或已不再是项目同行者。' }
    throw error
  }
  refresh(projectId.data)
  const from = z.enum(['dashboard', 'detail', 'timeline']).safeParse(formData.get('from'))
  const projectFrom = z.enum(['dashboard', 'projects']).safeParse(formData.get('projectFrom'))
  const timelineFrom = z.enum(['dashboard', 'detail', 'notifications']).safeParse(formData.get('timelineFrom'))
  redirect(`/projects/${projectId.data}/updates?submitted=${screeningResult === 'BLOCK' ? 'blocked' : screeningResult === 'PUBLISHED' ? 'published' : '1'}&from=${from.success && from.data === 'timeline' && timelineFrom.success ? timelineFrom.data : from.success && from.data === 'dashboard' ? 'dashboard' : 'detail'}&projectFrom=${projectFrom.success ? projectFrom.data : 'projects'}`)
}

/** 被自动规则暂缓的作者本人可以要求网站管理员人工判断，不能由发起人代替。 */
export async function requestProjectUpdateReviewAction(_previous: UpdateFormState, formData: FormData): Promise<UpdateFormState> {
  const author = await getCurrentUser()
  if (!author) return { error: '请先登录，再申请人工复核。' }
  const id = uuid.safeParse(formData.get('updateId'))
  if (!id.success) return { error: '找不到这条动态。' }
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      const update = await tx.projectUpdate.findUnique({
        where: { id: id.data },
        select: { id: true, authorId: true, status: true, reviewedById: true, scan: { select: { result: true } },
          project: { select: { id: true, creatorId: true, title: true } } },
      })
      if (!update || update.authorId !== author.id || update.status !== 'REJECTED' || update.scan?.result !== 'BLOCK' || update.reviewedById) {
        throw new Error('NO_AUTO_BLOCK')
      }
      const changed = await tx.projectUpdate.updateMany({ where: { id: update.id, status: 'REJECTED', reviewedById: null },
        data: { status: 'PENDING', rejectionReason: null, submittedAt: new Date() } })
      if (changed.count !== 1) throw new Error('NO_AUTO_BLOCK')
      projectId = update.project.id
      await tx.projectUpdateEvent.create({ data: { updateId: update.id, actorUserId: author.id, type: 'REVIEW_REQUESTED', note: '作者对自动暂缓结果申请人工复核。' } })
      const admins = await tx.siteAdmin.findMany({ where: { active: true, permissions: { has: 'PROJECT_REVIEW' } }, select: { userId: true } })
      const eligible = new Set(admins.map(item => item.userId))
      const siteOwnerId = getSiteOwnerUserId()
      if (siteOwnerId) eligible.add(siteOwnerId)
      eligible.delete(author.id)
      eligible.delete(update.project.creatorId)
      await createNotifications(tx, [...eligible].map(userId => ({
        recipientUserId: userId, sourceKey: `screening-appeal:${update.id}`, type: 'PROJECT_UPDATE_SUBMITTED',
        title: '有动态申请人工复核', summary: `项目「${update.project.title}」有系统暂缓的动态需独立复核。`,
        href: `/admin/updates/${update.id}`,
      })))
      if (eligible.size === 0 && siteOwnerId) await createNotifications(tx, [{
        recipientUserId: siteOwnerId, sourceKey: `screening-appeal-assignment:${update.id}`,
        type: 'PROJECT_UPDATE_ASSIGNMENT_NEEDED', title: '动态复核需要独立审核员',
        summary: '作者与项目发起人不能复核自己的内容，请授权其他网站审核员。', href: '/admin/staff',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_AUTO_BLOCK') return { error: '此动态已进入人工审核，或不属于可复核的系统暂缓记录。' }
    throw error
  }
  refresh(projectId)
  return { success: '已申请网站管理员人工复核，原自动筛查结果仍保留。' }
}

export async function decideProjectUpdateAction(_previous: UpdateFormState, formData: FormData): Promise<UpdateFormState> {
  const admin = await getCurrentAdmin('PROJECT_REVIEW')
  if (!admin) return { error: '只有有权限的网站管理员可以审核项目动态。' }
  const updateId = uuid.safeParse(formData.get('updateId'))
  const decision = z.enum(['APPROVED', 'REJECTED']).safeParse(formData.get('decision'))
  if (!updateId.success || !decision.success) return { error: '审核记录或处理结果无效。' }
  const reason = decision.data === 'REJECTED'
    ? projectUpdateRejectionSchema.safeParse(formData.get('reason'))
    : z.string().trim().max(500, '审核备注最多 500 个字。').safeParse(formData.get('reason') ?? '')
  if (!reason.success) return { error: reason.error.issues[0].message }

  let projectId = ''
  try {
    await db.$transaction(async tx => {
      const update = await tx.projectUpdate.findUnique({
        where: { id: updateId.data },
        select: {
          id: true, title: true, status: true, authorId: true, authorNameSnapshot: true,
          project: { select: { id: true, title: true, status: true, creatorId: true } },
          events: { where: { type: 'REOPENED' }, select: { actorUserId: true, previousReviewerIdSnapshot: true } },
        },
      })
      if (!update || update.status !== 'PENDING') throw new Error('UPDATE_ALREADY_REVIEWED')
      if (update.project.creatorId === admin.id || update.authorId === admin.id ||
        update.events.some(event => event.actorUserId === admin.id || event.previousReviewerIdSnapshot === admin.id)) {
        throw new Error('REVIEW_CONFLICT')
      }
      if (decision.data === 'APPROVED') {
        if (update.project.status !== 'PUBLISHED') throw new Error('PROJECT_NOT_PUBLISHED')
        if (update.authorId !== update.project.creatorId) {
          const membership = update.authorId ? await tx.projectMembership.findUnique({
            where: { projectId_userId: { projectId: update.project.id, userId: update.authorId } },
            select: { status: true, permissions: true },
          }) : null
          if (membership?.status !== 'ACTIVE' || !membership.permissions.includes('SUBMIT_UPDATES')) {
            throw new Error('AUTHOR_ACCESS_CHANGED')
          }
        }
      }
      const now = new Date()
      const changed = await tx.projectUpdate.updateMany({
        where: { id: update.id, status: 'PENDING' },
        data: {
          status: decision.data === 'APPROVED' ? 'PUBLISHED' : 'REJECTED',
          reviewedAt: now, reviewedById: admin.id,
          publishedAt: decision.data === 'APPROVED' ? now : null,
          rejectionReason: decision.data === 'REJECTED' ? reason.data : null,
        },
      })
      if (changed.count !== 1) throw new Error('UPDATE_ALREADY_REVIEWED')
      const event = await tx.projectUpdateEvent.create({
        data: { updateId: update.id, actorUserId: admin.id, type: decision.data, note: reason.data || null },
      })
      projectId = update.project.id
      await tx.userNotification.updateMany({
        where: { href: `/admin/updates/${update.id}`, type: 'PROJECT_UPDATE_SUBMITTED', readAt: null }, data: { readAt: now },
      })
      const recipients = new Set<string>()
      if (update.authorId) recipients.add(update.authorId)
      recipients.add(update.project.creatorId)
      await createNotifications(tx, [...recipients].map(id => ({
        recipientUserId: id, sourceKey: `project-update-result:${event.id}`,
        type: 'PROJECT_UPDATE_REVIEWED', title: decision.data === 'APPROVED' ? '项目动态审核通过' : '项目动态已退回',
        summary: `项目「${update.project.title}」的动态已${decision.data === 'APPROVED' ? '进入公开时间线' : '附上退回原因'}。`,
        href: `/projects/${projectId}/updates`,
      })))
      if (decision.data === 'APPROVED') await notifyProjectFavorites(tx, update.project.id, update.project.title,
        update.id, update.title, update.authorId ?? update.project.creatorId)
      const siteOwnerId = getSiteOwnerUserId()
      if (siteOwnerId && siteOwnerId !== admin.id) {
        await createNotifications(tx, [{
          recipientUserId: siteOwnerId, sourceKey: `owner-update-review:${event.id}`,
          type: 'OWNER_UPDATE_REVIEWED', title: '管理员处理了一条项目动态',
          summary: `${admin.displayName} 审核了项目「${update.project.title}」的动态；记录可追溯。`,
          href: `/admin/updates/${update.id}`,
        }])
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UPDATE_ALREADY_REVIEWED') return { error: '该动态已经被处理，请刷新页面。' }
    if (error instanceof Error && error.message === 'REVIEW_CONFLICT') return { error: '您是项目发起人或动态作者，请交由无利益冲突的管理员审核。' }
    if (error instanceof Error && error.message === 'PROJECT_NOT_PUBLISHED') return { error: '项目已不再公开，不能发布动态；请退回并说明情况。' }
    if (error instanceof Error && error.message === 'AUTHOR_ACCESS_CHANGED') return { error: '作者的项目权限已经变化，不能批准；请退回并说明情况。' }
    throw error
  }
  refresh(projectId)
  revalidatePath(`/admin/updates/${updateId.data}`)
  return { success: decision.data === 'APPROVED' ? '动态已进入公开时间线，并通知作者。' : '已退回并通知作者，退回原因已留档。' }
}

/** 站主可撤销管理员的发布或退回裁决；原裁决作为事件保留，再由独立审查员处理。 */
export async function reopenProjectUpdateAction(_previous: UpdateFormState, formData: FormData): Promise<UpdateFormState> {
  const owner = await getCurrentUser()
  if (!owner || !isSiteOwner(owner.id)) return { error: '只有站主可以撤销网站管理员的动态裁决。' }
  const updateId = uuid.safeParse(formData.get('updateId'))
  const reason = z.string().trim().min(10, '请写至少 10 个字说明撤销原因。').max(2000, '原因最多 2000 字。').safeParse(formData.get('reason'))
  if (!updateId.success) return { error: '动态记录无效。' }
  if (!reason.success) return { error: reason.error.issues[0].message }

  let projectId = ''
  try {
    await db.$transaction(async tx => {
      const update = await tx.projectUpdate.findUnique({
        where: { id: updateId.data },
        select: {
          id: true, status: true, rejectionReason: true, reviewedAt: true, reviewedById: true,
          authorId: true, project: { select: { id: true, title: true, creatorId: true } },
          events: { where: { type: 'REOPENED' }, select: { actorUserId: true, previousReviewerIdSnapshot: true } },
        },
      })
      if (!update || update.status === 'PENDING' || !update.reviewedById) throw new Error('NOT_REVIEWED')
      if (update.reviewedById === owner.id) throw new Error('OWN_DECISION')
      projectId = update.project.id
      const changed = await tx.projectUpdate.updateMany({
        where: { id: update.id, status: update.status, reviewedById: update.reviewedById },
        data: { status: 'PENDING', reviewedAt: null, reviewedById: null, publishedAt: null, rejectionReason: null },
      })
      if (changed.count !== 1) throw new Error('NOT_REVIEWED')
      const event = await tx.projectUpdateEvent.create({
        data: {
          updateId: update.id, actorUserId: owner.id, type: 'REOPENED', note: reason.data,
          previousStatus: update.status, previousReasonSnapshot: update.rejectionReason,
          previousReviewerIdSnapshot: update.reviewedById, previousReviewedAtSnapshot: update.reviewedAt,
        },
      })
      if (update.status === 'HIDDEN') {
        const earlierReporters = await tx.projectUpdateReport.findMany({ where: { updateId: update.id, decision: 'CONTENT_REMOVED' },
          select: { reporterId: true } })
        await createNotifications(tx, [...new Set(earlierReporters.map(item => item.reporterId))].map(id => ({
          recipientUserId: id, sourceKey: `report-correction:${event.id}:${id}`,
          type: 'UPDATE_REPORT_CORRECTED', title: '您举报的动态有新的处理进展',
          summary: `项目「${update.project.title}」的原下架决定已撤销；动态转入重新审核，原举报记录仍保留。`, href: '/reports',
        })))
        const pendingAppeals = await tx.projectUpdateRemovalAppeal.findMany({ where: { updateId: update.id, status: 'PENDING' }, select: { id: true } })
        if (pendingAppeals.length) {
          await tx.projectUpdateRemovalAppeal.updateMany({ where: { id: { in: pendingAppeals.map(item => item.id) }, status: 'PENDING' }, data: {
            status: 'RESOLVED', decision: 'REOPENED', decisionReason: `站主直接撤销原下架：${reason.data}`, reviewedById: owner.id, reviewedAt: new Date(),
          } })
          await tx.projectUpdateRemovalAppealEvent.createMany({ data: pendingAppeals.map(item => ({
            appealId: item.id, actorUserId: owner.id, action: 'OWNER_REVOKED_ORIGINAL', reason: reason.data,
          })) })
          await tx.userNotification.updateMany({ where: { sourceKey: { in: pendingAppeals.map(item => `hidden-update-appeal:${item.id}`) }, readAt: null }, data: { readAt: new Date() } })
        }
      }
      await tx.userNotification.updateMany({
        where: { href: `/admin/updates/${update.id}`, type: 'PROJECT_UPDATE_SUBMITTED', readAt: null }, data: { readAt: new Date() },
      })
      const staff = await tx.siteAdmin.findMany({
        where: { active: true, permissions: { has: 'PROJECT_REVIEW' } }, select: { userId: true },
      })
      const reviewers = new Set([...staff.map(item => item.userId), owner.id])
      reviewers.delete(update.project.creatorId)
      if (update.authorId) reviewers.delete(update.authorId)
      for (const prior of [...update.events, { actorUserId: owner.id, previousReviewerIdSnapshot: update.reviewedById }]) {
        if (prior.actorUserId) reviewers.delete(prior.actorUserId)
        if (prior.previousReviewerIdSnapshot) reviewers.delete(prior.previousReviewerIdSnapshot)
      }
      await createNotifications(tx, [...reviewers].map(id => ({
        recipientUserId: id, sourceKey: `update-reopened-review:${event.id}:${id}`,
        type: 'PROJECT_UPDATE_SUBMITTED', title: '有项目动态重新等待审核',
        summary: `项目「${update.project.title}」的动态已撤销原裁决，需独立重审。`, href: `/admin/updates/${update.id}`,
      })))
      if (reviewers.size === 0) {
        await createNotifications(tx, [{
          recipientUserId: owner.id, sourceKey: `update-reopened-assignment:${event.id}`,
          type: 'PROJECT_UPDATE_ASSIGNMENT_NEEDED', title: '重审动态缺少独立审核员',
          summary: '请授权未参与过此动态裁决的网站管理员。', href: '/admin/staff',
        }])
      }
      const affected = new Set([update.project.creatorId, update.reviewedById])
      if (update.authorId) affected.add(update.authorId)
      affected.delete(owner.id)
      await createNotifications(tx, [...affected].map(id => ({
        recipientUserId: id, sourceKey: `update-reopened-result:${event.id}:${id}`,
        type: 'PROJECT_UPDATE_REOPENED', title: '项目动态原审核结果已撤销',
        summary: `项目「${update.project.title}」的动态已回到待审，原裁决和撤销原因均已留档。`,
        href: id === update.reviewedById ? `/admin/updates/${update.id}` : `/projects/${projectId}/updates`,
      })))
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_REVIEWED') return { error: '这条动态不是已处理状态，或状态已变化，请刷新页面。' }
    if (error instanceof Error && error.message === 'OWN_DECISION') return { error: '不能撤销自己作出的裁决；请交由独立人员复核。' }
    throw error
  }
  refresh(projectId)
  revalidatePath(`/admin/updates/${updateId.data}`)
  revalidatePath('/admin/staff')
  return { success: '已撤销管理员裁决，原裁决留档，并通知当事人与独立审核员。' }
}
