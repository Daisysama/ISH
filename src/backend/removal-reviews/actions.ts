'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getCurrentAdmin, getSiteOwnerUserId } from '@/backend/auth/admin'
import { getCurrentUser } from '@/backend/auth/current-user'
import { getWritingUser } from '@/backend/auth/write-access'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'

export type ReviewActionState = { error?: string; success?: string }

const idSchema = z.string().uuid()
// 旧成员移出由 migration 用 md5 回填回执 ID；新回执由 Prisma 生成 UUID。
// 两种编号都只用于定位记录，后续仍须核对回执归属当前申请人。
const removalRecordIdSchema = z.union([idSchema, z.string().regex(/^[0-9a-f]{32}$/i)])
const recipientSchema = z.enum(['FOUNDER', 'PLATFORM'])
const categorySchema = z.enum(['MISTAKE', 'FACT_DISPUTE', 'RETALIATION', 'CONTRIBUTION', 'OTHER'])
const statementSchema = z.string().trim().min(10, '请至少写 10 个字说明情况。').max(2000, '说明请控制在 2000 字以内。')
const decisionReasonSchema = z.string().trim().min(10, '请至少写 10 个字说明处理依据。').max(2000, '处理说明请控制在 2000 字以内。')
const founderDecisionSchema = z.enum(['RESTORED', 'DECLINED'])
const platformDecisionSchema = z.enum(['NO_VIOLATION', 'RECORD_CORRECTION', 'MISCONDUCT'])

function refresh(projectId: string) {
  revalidatePath('/dashboard')
  revalidatePath('/admin/removal-appeals')
  revalidatePath('/admin/staff')
  revalidatePath('/notifications')
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/team`)
  revalidatePath(`/projects/${projectId}/removal-review`)
}

export async function submitRemovalReviewAction(
  _previous: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const removalId = removalRecordIdSchema.safeParse(formData.get('removalId'))
  const recipient = recipientSchema.safeParse(formData.get('recipient'))
  const category = categorySchema.safeParse(formData.get('category') || 'OTHER')
  const statement = statementSchema.safeParse(formData.get('statement'))
  if (!removalId.success) return { error: '移出回执编号无法识别，请从“我的项目”重新进入申诉页。' }
  if (!recipient.success) return { error: '申诉通道无效，请从“我的项目”重新进入申诉页。' }
  if (!category.success) return { error: '主要问题的选项无效，请重新选择。' }
  if (!statement.success) return { error: statement.error.issues[0].message }

  let projectId = ''
  try {
    await db.$transaction(async (tx) => {
      const removal = await tx.projectRemovalRecord.findUnique({
        where: { id: removalId.data },
        select: {
          id: true, projectId: true, membershipId: true, removedAt: true,
          removedByNameSnapshot: true, reasonSnapshot: true,
          membership: { select: { userId: true } },
          project: { select: { creatorId: true, title: true } },
        },
      })
      if (!removal || removal.membership.userId !== user.id) throw new Error('NOT_REMOVED')
      projectId = removal.projectId
      const review = await tx.projectRemovalReview.create({
        data: {
          projectId: removal.projectId,
          membershipId: removal.membershipId,
          removalId: removal.id,
          appellantUserId: user.id,
          removedAt: removal.removedAt,
          removedByNameSnapshot: removal.removedByNameSnapshot,
          removalReasonSnapshot: removal.reasonSnapshot,
          recipient: recipient.data,
          category: category.data,
          statement: statement.data,
        },
      })
      await tx.projectRemovalReviewEvent.create({
        data: { reviewId: review.id, actorUserId: user.id, type: 'SUBMITTED' },
      })
      if (recipient.data === 'FOUNDER') {
        await createNotifications(tx, [{
          recipientUserId: removal.project.creatorId, sourceKey: `founder-review:${review.id}`,
          type: 'FOUNDER_REVIEW_REQUESTED', title: '有同行者申请核查移出',
          summary: `请查看项目「${removal.project.title}」的核查申请。`, href: `/projects/${removal.projectId}/team`,
        }])
      } else {
        const staff = await tx.siteAdmin.findMany({
          where: { active: true, permissions: { has: 'APPEAL_REVIEW' } }, select: { userId: true },
        })
        const ownerId = getSiteOwnerUserId()
        const eligible = new Set(staff.map(admin => admin.userId))
        if (ownerId) eligible.add(ownerId)
        eligible.delete(user.id)
        eligible.delete(removal.project.creatorId)
        await createNotifications(tx, [...eligible].map(id => ({
          recipientUserId: id, sourceKey: `appeal:${review.id}`, type: 'PLATFORM_APPEAL_SUBMITTED',
          title: '有同行移出申诉待独立审查', summary: `请查看项目「${removal.project.title}」的申诉。`,
          href: '/admin/removal-appeals',
        })))
        if (eligible.size === 0 && ownerId && ownerId !== user.id) {
          await createNotifications(tx, [{
            recipientUserId: ownerId, sourceKey: `appeal-assignment:${review.id}`,
            type: 'APPEAL_ASSIGNMENT_NEEDED', title: '有申诉需要独立审查员',
            summary: '当前没有无利益冲突的审查员，请授权独立管理员。', href: '/admin/staff',
          }])
        }
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_REMOVED') return { error: '移出回执不存在或不属于您。' }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return { error: '本次移出已向该对象提交过申请，请查看处理状态。' }
    }
    throw error
  }
  refresh(projectId)
  return { success: recipient.data === 'PLATFORM' ? '已提交给网站管理员；项目发起人无权处理本次平台申诉。' : '已向项目发起人提交核查申请。' }
}

export async function decideRemovalReviewAction(
  _previous: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await getWritingUser('MANAGE')
  if (!user) redirect('/login')
  const reviewId = idSchema.safeParse(formData.get('reviewId'))
  const reason = decisionReasonSchema.safeParse(formData.get('reason'))
  if (!reviewId.success) return { error: '申请记录不存在。' }
  if (!reason.success) return { error: reason.error.issues[0].message }

  const review = await db.projectRemovalReview.findUnique({
    where: { id: reviewId.data },
    select: {
      id: true, projectId: true, membershipId: true, removedAt: true, status: true,
      recipient: true, appellantUserId: true,
      project: { select: { creatorId: true } },
      appellant: { select: { displayName: true } },
    },
  })
  if (!review) return { error: '申请记录不存在。' }
  if (review.recipient === 'FOUNDER' && review.project.creatorId !== user.id) return { error: '仅项目发起人可处理此核查。' }
  if (review.recipient === 'PLATFORM') {
    const admin = await getCurrentAdmin('APPEAL_REVIEW')
    if (!admin || review.project.creatorId === user.id || review.appellantUserId === user.id) {
      return { error: '平台申诉必须由无利益冲突的网站管理员处理。' }
    }
    const priorDecision = await db.projectRemovalReviewEvent.findFirst({
      where: {
        reviewId: review.id, type: 'REOPENED',
        OR: [{ actorUserId: user.id }, { deciderUserIdSnapshot: user.id }],
      },
      select: { id: true },
    })
    if (priorDecision) return { error: '您参与过本案的撤销或原裁决，请交由另一位网站管理员重审。' }
  }
  const decision = review.recipient === 'FOUNDER'
    ? founderDecisionSchema.safeParse(formData.get('decision'))
    : platformDecisionSchema.safeParse(formData.get('decision'))
  if (!decision.success) return { error: '请选择有效的处理结果。' }

  try {
    await db.$transaction(async (tx) => {
      const locked = await tx.projectRemovalReview.updateMany({
        where: { id: review.id, status: 'PENDING' },
        data: {
          status: 'RESOLVED',
          decision: decision.data,
          decisionReason: reason.data,
          decidedByUserId: user.id,
          decidedAt: new Date(),
        },
      })
      if (locked.count !== 1) throw new Error('ALREADY_DECIDED')

      if (decision.data === 'RESTORED') {
        const restored = await tx.projectMembership.updateMany({
          where: { id: review.membershipId, status: 'REMOVED', leftAt: review.removedAt },
          data: {
            status: 'ACTIVE', joinedAt: new Date(), leftAt: null,
            departureReason: null, removedByUserId: null, permissions: [],
          },
        })
        if (restored.count !== 1) throw new Error('MEMBERSHIP_CHANGED')
        await tx.projectActivity.create({
          data: {
            projectId: review.projectId, actorUserId: user.id, type: 'MEMBER_RESTORED',
            summary: `${review.appellant.displayName} 恢复同行`, reason: reason.data,
            metadata: { reviewId: review.id },
          },
        })
      }
      const resolvedEvent = await tx.projectRemovalReviewEvent.create({
        data: { reviewId: review.id, actorUserId: user.id, type: 'RESOLVED', note: reason.data },
      })
      if (review.recipient === 'PLATFORM') {
        await tx.userNotification.updateMany({
          where: {
            OR: [
              { sourceKey: `appeal:${review.id}` },
              { sourceKey: { startsWith: `appeal-reopened-queue:${review.id}:` } },
            ],
            readAt: null,
          },
          data: { readAt: new Date() },
        })
      }
      await createNotifications(tx, [{
        recipientUserId: review.appellantUserId, sourceKey: `review-result:${resolvedEvent.id}`,
        type: 'REMOVAL_REVIEW_RESOLVED', title: '您的同行移出申请已有处理结果',
        summary: '处理结论与原始记录均已保留，请查看详情。', href: `/projects/${review.projectId}/removal-review`,
      }])
      const ownerId = getSiteOwnerUserId()
      if (review.recipient === 'PLATFORM' && ownerId && ownerId !== user.id) {
        const conflicted = ownerId === review.project.creatorId || ownerId === review.appellantUserId
        await createNotifications(tx, [{
          recipientUserId: ownerId, sourceKey: `owner-appeal-decision:${resolvedEvent.id}`,
          type: 'OWNER_APPEAL_DECISION', title: '网站管理员已处理一条平台申诉',
          summary: conflicted ? '您与此案有关，不能查看申诉正文或撤销裁决；请安排独立纠错员。' : `裁决由 ${user.displayName} 作出，您可核查并纠错。`,
          href: conflicted ? '/admin/staff' : `/admin/removal-appeals#review-${review.id}`,
        }])
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'ALREADY_DECIDED') return { error: '这条申请已经处理过，请刷新页面。' }
    if (error instanceof Error && error.message === 'MEMBERSHIP_CHANGED') return { error: '成员状态已变化；请刷新后重新核查。' }
    throw error
  }
  refresh(review.projectId)
  return { success: '处理结果已记录，申请人可在自己的项目历史中查看。' }
}

/** 只撤销平台裁决的效力并重新排队；原裁决快照与纠错原因作为新事件保存。 */
export async function reopenPlatformAppealAction(
  _previous: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const actor = await getCurrentUser()
  if (!actor) redirect('/login')
  const reviewer = await getCurrentAdmin('APPEAL_REVIEW')
  const corrector = await getCurrentAdmin('APPEAL_CORRECTION')
  if (!reviewer || !corrector) return { error: '只有站主或获授权的独立纠错员能撤销平台裁决。' }
  const reviewId = idSchema.safeParse(formData.get('reviewId'))
  const reason = decisionReasonSchema.safeParse(formData.get('reason'))
  if (!reviewId.success) return { error: '申诉编号无效。' }
  if (!reason.success) return { error: reason.error.issues[0].message }

  const review = await db.projectRemovalReview.findUnique({
    where: { id: reviewId.data },
    select: {
      id: true, projectId: true, status: true, recipient: true, appellantUserId: true,
      decision: true, decisionReason: true, decidedByUserId: true, decidedAt: true,
      decidedBy: { select: { displayName: true } },
      project: { select: { creatorId: true, title: true } },
    },
  })
  if (!review || review.recipient !== 'PLATFORM') return { error: '只能纠正平台受理的申诉。' }
  if (review.appellantUserId === actor.id || review.project.creatorId === actor.id || review.decidedByUserId === actor.id) {
    return { error: '您是本案当事人或原裁决人，须交由另一位网站纠错员处理。' }
  }
  const priorParticipation = await db.projectRemovalReviewEvent.findFirst({
    where: {
      reviewId: review.id, type: 'REOPENED',
      OR: [{ actorUserId: actor.id }, { deciderUserIdSnapshot: actor.id }],
    },
    select: { id: true },
  })
  if (priorParticipation) return { error: '您参与过本案的既往裁决或纠错，请交由另一位纠错员。' }
  if (review.status !== 'RESOLVED' || !review.decision || !review.decidedAt) {
    return { error: '本案当前没有可撤销的已生效裁决，请刷新页面。' }
  }

  try {
    await db.$transaction(async tx => {
      const changed = await tx.projectRemovalReview.updateMany({
        where: { id: review.id, status: 'RESOLVED', decidedAt: review.decidedAt },
        data: {
          status: 'PENDING', decision: null, decisionReason: null,
          decidedByUserId: null, decidedAt: null, appellantDecisionSeenAt: null,
        },
      })
      if (changed.count !== 1) throw new Error('REVIEW_CHANGED')
      const event = await tx.projectRemovalReviewEvent.create({
        data: {
          reviewId: review.id, actorUserId: actor.id, type: 'REOPENED', note: reason.data,
          decisionSnapshot: review.decision, decisionReasonSnapshot: review.decisionReason,
          deciderUserIdSnapshot: review.decidedByUserId,
          deciderNameSnapshot: review.decidedBy?.displayName ?? '已注销审查员',
          decidedAtSnapshot: review.decidedAt,
        },
      })
      await createNotifications(tx, [{
        recipientUserId: review.appellantUserId, sourceKey: `appeal-reopened:${event.id}`,
        type: 'APPEAL_REOPENED', title: '平台申诉裁决已撤销并重新审查',
        summary: `项目「${review.project.title}」的原裁决和撤销理由仍可在申请记录中查看。`,
        href: `/projects/${review.projectId}/removal-review`,
      }])
      if (review.decidedByUserId && review.decidedBy) {
        await createNotifications(tx, [{
          recipientUserId: review.decidedByUserId, sourceKey: `appeal-corrected:${event.id}`,
          type: 'APPEAL_DECISION_WITHDRAWN', title: '您处理的申诉已进入纠错重审',
          summary: '纠错原因与原裁决已留痕；本案须交由其他审查员处理。', href: '/notifications',
        }])
      }
      const staff = await tx.siteAdmin.findMany({
        where: { active: true, permissions: { has: 'APPEAL_REVIEW' } }, select: { userId: true },
      })
      const priorCorrections = await tx.projectRemovalReviewEvent.findMany({
        where: { reviewId: review.id, type: 'REOPENED' },
        select: { actorUserId: true, deciderUserIdSnapshot: true },
      })
      const eligible = new Set(staff.map(item => item.userId))
      const ownerId = getSiteOwnerUserId()
      if (ownerId) eligible.add(ownerId)
      eligible.delete(review.appellantUserId)
      eligible.delete(review.project.creatorId)
      eligible.delete(review.decidedByUserId ?? '')
      eligible.delete(actor.id)
      for (const prior of priorCorrections) {
        if (prior.actorUserId) eligible.delete(prior.actorUserId)
        if (prior.deciderUserIdSnapshot) eligible.delete(prior.deciderUserIdSnapshot)
      }
      await createNotifications(tx, [...eligible].map(id => ({
        recipientUserId: id, sourceKey: `appeal-reopened-queue:${review.id}:${event.id}`,
        type: 'PLATFORM_APPEAL_REOPENED', title: '有一条申诉需要独立重审',
        summary: '原裁决已撤销并留下原因；请由未参与原案的审查员复核。', href: `/admin/removal-appeals#review-${review.id}`,
      })))
      if (eligible.size === 0 && ownerId && ownerId !== actor.id) {
        await createNotifications(tx, [{
          recipientUserId: ownerId, sourceKey: `appeal-reopened-assignment:${event.id}`,
          type: 'APPEAL_ASSIGNMENT_NEEDED', title: '有申诉重审需要另行授权审查员',
          summary: '原裁决人和纠错员不能审查同一重开案件。', href: '/admin/staff',
        }])
      }
      if (ownerId && ownerId !== actor.id) {
        const conflicted = ownerId === review.appellantUserId || ownerId === review.project.creatorId
        await createNotifications(tx, [{
          recipientUserId: ownerId, sourceKey: `owner-appeal-reopened:${event.id}`,
          type: 'OWNER_APPEAL_CORRECTION', title: '独立纠错员已撤销一次平台裁决',
          summary: conflicted ? '您与本案有关；请由其他无利益冲突的审查员接手。' : `${actor.displayName} 已留痕撤销原裁决，案件重新待审。`,
          href: conflicted ? '/admin/staff' : `/admin/removal-appeals#review-${review.id}`,
        }])
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'REVIEW_CHANGED') return { error: '案件状态已变化，请刷新后重试。' }
    throw error
  }
  refresh(review.projectId)
  return { success: '原裁决已留存快照并撤销，本案已重新进入独立审查队列。' }
}

/** 发起人发现点错人时无需等待成员申请；仍以事务保留恢复活动。 */
export async function restoreRemovedMemberAction(
  _previous: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await getWritingUser('MANAGE')
  if (!user) redirect('/login')
  const membershipId = idSchema.safeParse(formData.get('membershipId'))
  const reason = decisionReasonSchema.safeParse(formData.get('reason'))
  if (!membershipId.success) return { error: '成员记录不存在。' }
  if (!reason.success) return { error: reason.error.issues[0].message }
  const membership = await db.projectMembership.findUnique({
    where: { id: membershipId.data },
    select: {
      id: true, projectId: true, userId: true, leftAt: true, status: true,
      user: { select: { displayName: true } },
      project: { select: { creatorId: true } },
    },
  })
  if (!membership || membership.project.creatorId !== user.id) return { error: '无权恢复该成员。' }
  if (membership.status !== 'REMOVED' || !membership.leftAt) return { error: '成员状态已变化，请刷新页面。' }
  const removedAt = membership.leftAt
  try {
    await db.$transaction(async (tx) => {
      const changed = await tx.projectMembership.updateMany({
        where: { id: membership.id, status: 'REMOVED', leftAt: removedAt },
        data: {
          status: 'ACTIVE', joinedAt: new Date(), leftAt: null,
          departureReason: null, removedByUserId: null, permissions: [],
        },
      })
      if (changed.count !== 1) throw new Error('MEMBERSHIP_CHANGED')
      await tx.projectActivity.create({
        data: {
          projectId: membership.projectId, actorUserId: user.id, type: 'MEMBER_RESTORED',
          summary: `${membership.user.displayName} 恢复同行`, reason: reason.data,
        },
      })
      const pending = await tx.projectRemovalReview.findFirst({
        where: {
          membershipId: membership.id, removedAt,
          recipient: 'FOUNDER', status: 'PENDING',
        },
        select: { id: true },
      })
      if (pending) {
        await tx.projectRemovalReview.update({
          where: { id: pending.id },
          data: {
            status: 'RESOLVED', decision: 'RESTORED', decisionReason: reason.data,
            decidedByUserId: user.id, decidedAt: new Date(),
          },
        })
        await tx.projectRemovalReviewEvent.create({
          data: { reviewId: pending.id, actorUserId: user.id, type: 'RESOLVED', note: reason.data },
        })
        await createNotifications(tx, [{
          recipientUserId: membership.userId, sourceKey: `review-result:${pending.id}`,
          type: 'REMOVAL_REVIEW_RESOLVED', title: '您的同行移出申请已有处理结果',
          summary: '发起人已恢复同行，请查看记录。', href: `/projects/${membership.projectId}/removal-review`,
        }])
      }
      await createNotifications(tx, [{
        recipientUserId: membership.userId, sourceKey: `restored:${membership.id}:${removedAt.toISOString()}`,
        type: 'PROJECT_MEMBERSHIP_RESTORED', title: '您已恢复同行',
        summary: '此前的移出记录和平台申诉仍保留。', href: `/projects/${membership.projectId}/removal-review`,
      }])
      // 向网站管理员的独立申诉不会因发起人恢复而自动关闭。
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'MEMBERSHIP_CHANGED') return { error: '成员状态已变化，请刷新页面。' }
    throw error
  }
  refresh(membership.projectId)
  return { success: '已恢复同行；之前的移出事实仍保留在项目活动中。' }
}

/** 仅申请人本人打开该项目复核页后，确认这一项目的已处理结果已展示。 */
export async function markRemovalReviewDecisionsSeenAction(projectId: string): Promise<void> {
  const user = await getCurrentUser()
  const parsedId = idSchema.safeParse(projectId)
  if (!user || !parsedId.success) return
  await db.projectRemovalReview.updateMany({
    where: {
      projectId: parsedId.data, appellantUserId: user.id,
      status: 'RESOLVED', appellantDecisionSeenAt: null,
    },
    data: { appellantDecisionSeenAt: new Date() },
  })
  revalidatePath('/dashboard')
  revalidatePath(`/projects/${parsedId.data}/removal-review`)
}
