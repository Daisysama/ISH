'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getCurrentUser } from '@/backend/auth/current-user'
import { getWritingUser } from '@/backend/auth/write-access'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'
import { MEMBER_PERMISSIONS } from '@/core/memberships/permissions'

export type MemberPermissionState = { error?: string; success?: string }

export async function setMemberPermissionsAction(_previous: MemberPermissionState, formData: FormData): Promise<MemberPermissionState> {
  const owner = await getWritingUser('MANAGE')
  if (!owner) redirect('/login')
  const membershipId = z.string().uuid().safeParse(formData.get('membershipId'))
  const reason = z.string().trim().min(10, '请写至少 10 个字说明授权或撤销原因。').max(500, '原因最多 500 字。').safeParse(formData.get('reason'))
  const permissions = formData.getAll('permissions')
  if (!membershipId.success) return { error: '同行者记录无效。' }
  if (!reason.success) return { error: reason.error.issues[0].message }
  if (permissions.some(value => typeof value !== 'string' || !MEMBER_PERMISSIONS.includes(value as typeof MEMBER_PERMISSIONS[number]))) {
    return { error: '提交了未知的项目权限，请重新进入同行者页面。' }
  }
  const next = [...new Set(permissions as string[])]
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      const member = await tx.projectMembership.findUnique({
        where: { id: membershipId.data },
        select: {
          id: true, projectId: true, status: true, userId: true, permissions: true,
          user: { select: { displayName: true } },
          project: { select: { creatorId: true, title: true } },
        },
      })
      if (!member || member.project.creatorId !== owner.id) throw new Error('NOT_OWNER')
      if (member.status !== 'ACTIVE') throw new Error('NOT_ACTIVE')
      if (member.permissions.length === next.length && member.permissions.every(value => next.includes(value))) throw new Error('NO_CHANGE')
      const updated = await tx.projectMembership.updateMany({
        where: { id: member.id, status: 'ACTIVE', permissions: { equals: member.permissions } },
        data: { permissions: next },
      })
      if (updated.count !== 1) throw new Error('MEMBER_CHANGED')
      projectId = member.projectId
      const event = await tx.projectActivity.create({
        data: {
          projectId, actorUserId: owner.id, type: 'MEMBER_PERMISSIONS_CHANGED',
          summary: `${member.user.displayName} 的项目权限已调整`, reason: reason.data,
          metadata: { membershipId: member.id, before: member.permissions, after: next, targetUserId: member.userId },
        },
      })
      await createNotifications(tx, [{
        recipientUserId: member.userId, sourceKey: `membership-permissions:${event.id}`,
        type: 'PROJECT_PERMISSION_CHANGED', title: '您的项目权限已调整',
        summary: `项目「${member.project.title}」的权限已更新；打开同行者页查看目前可做的事。`,
        href: `/projects/${projectId}/team`,
      }])
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_OWNER') return { error: '只有项目发起人可以设置本项目同行者权限。' }
      if (error.message === 'NOT_ACTIVE') return { error: '此人已不在项目中，无法授予权限。' }
      if (error.message === 'NO_CHANGE') return { error: '权限没有发生变化。' }
      if (error.message === 'MEMBER_CHANGED') return { error: '同行者状态刚发生变化，请刷新页面核对。' }
    }
    throw error
  }
  revalidatePath('/dashboard')
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/team`)
  revalidatePath('/notifications')
  return { success: '权限已保存，原因留在项目内部活动中，同行者已收到提醒。' }
}
