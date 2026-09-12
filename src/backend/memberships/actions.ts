'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getCurrentUser } from '@/backend/auth/current-user'
import { getWritingUser } from '@/backend/auth/write-access'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'

export type MembershipLifecycleActionState = {
  error?: string
  success?: string
}

const membershipIdSchema = z.string().uuid()
const projectIdSchema = z.string().uuid()
const reasonSchema = z.string().trim().min(5, '请至少写 5 个字说明原因。').max(500, '原因请控制在 500 字以内。')

function revalidateMembershipSurfaces(projectId: string) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/responses')
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/team`)
}

export async function removeProjectMemberAction(
  _prevState: MembershipLifecycleActionState,
  formData: FormData,
): Promise<MembershipLifecycleActionState> {
  const user = await getWritingUser('MANAGE')
  if (!user) redirect('/login')

  const membershipId = membershipIdSchema.safeParse(formData.get('membershipId'))
  const reason = reasonSchema.safeParse(formData.get('reason'))
  if (!membershipId.success) return { error: '同行者记录不存在。' }
  if (!reason.success) return { error: reason.error.issues[0].message }

  const membership = await db.projectMembership.findUnique({
    where: { id: membershipId.data },
    select: {
      id: true,
      projectId: true,
      userId: true,
      status: true,
      user: { select: { displayName: true } },
      project: { select: { creatorId: true } },
    },
  })

  if (!membership || membership.status !== 'ACTIVE') return { error: '这位同行者已经不在项目中。' }
  if (membership.project.creatorId !== user.id) return { error: '目前只有项目发起人可以移除同行者。' }
  if (membership.userId === user.id) return { error: '项目发起人不能把自己作为同行者移除。' }

  const now = new Date()
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.projectMembership.updateMany({
      where: { id: membership.id, status: 'ACTIVE' },
      data: {
        status: 'REMOVED',
        leftAt: now,
        departureReason: reason.data,
        removedByUserId: user.id,
        permissions: [],
      },
    })
    if (result.count !== 1) return false

    const removalRecord = await tx.projectRemovalRecord.create({
      data: {
        projectId: membership.projectId,
        membershipId: membership.id,
        removedAt: now,
        removedByUserIdSnapshot: user.id,
        removedByNameSnapshot: user.displayName,
        reasonSnapshot: reason.data,
      },
    })
    await tx.projectActivity.create({
      data: {
        projectId: membership.projectId,
        actorUserId: user.id,
        type: 'MEMBER_REMOVED',
        summary: `${membership.user.displayName} 被移出项目`,
        reason: reason.data,
      },
    })
    await createNotifications(tx, [{
      recipientUserId: membership.userId, sourceKey: `removed:${removalRecord.id}`,
      type: 'PROJECT_MEMBER_REMOVED', title: '您已被移出项目',
      summary: '移出时间、原因和核查/申诉入口已保留在您的项目历史中。',
      href: `/projects/${membership.projectId}/removal-review`,
    }])
    return true
  })

  if (!updated) return { error: '这位同行者的状态刚刚发生了变化，请刷新后再试。' }
  revalidateMembershipSurfaces(membership.projectId)
  return { success: '同行者已移出项目，原因已经留在内部活动记录中。' }
}

export async function leaveProjectAction(
  _prevState: MembershipLifecycleActionState,
  formData: FormData,
): Promise<MembershipLifecycleActionState> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const projectId = projectIdSchema.safeParse(formData.get('projectId'))
  const reason = reasonSchema.safeParse(formData.get('reason'))
  if (!projectId.success) return { error: '项目不存在。' }
  if (!reason.success) return { error: reason.error.issues[0].message }

  const membership = await db.projectMembership.findFirst({
    where: { projectId: projectId.data, userId: user.id, status: 'ACTIVE' },
    select: { id: true, projectId: true },
  })
  if (!membership) return { error: '您当前不是这个项目的同行者。' }

  const now = new Date()
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.projectMembership.updateMany({
      where: { id: membership.id, status: 'ACTIVE' },
      data: {
        status: 'LEFT',
        leftAt: now,
        departureReason: reason.data,
        removedByUserId: null,
        permissions: [],
      },
    })
    if (result.count !== 1) return false

    await tx.projectActivity.create({
      data: {
        projectId: membership.projectId,
        actorUserId: user.id,
        type: 'MEMBER_LEFT',
        summary: `${user.displayName} 主动退出了项目`,
        reason: reason.data,
      },
    })
    return true
  })

  if (!updated) return { error: '项目成员状态刚刚发生了变化，请刷新后再试。' }
  revalidateMembershipSurfaces(membership.projectId)
  redirect(`/projects/${membership.projectId}?from=dashboard`)
}
