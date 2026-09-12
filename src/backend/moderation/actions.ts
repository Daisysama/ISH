'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'

import { getCurrentAdmin, getSiteOwnerUserId } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'
import {
  moderationNoteSchema,
  projectIdSchema,
  projectRevisionIdSchema,
  rejectionReasonSchema,
} from '@/core/meow/project'
import type { ModerationFormState } from '@/shared/project'

async function requireAdmin() {
  const admin = await getCurrentAdmin()
  if (!admin) throw new Error('FORBIDDEN')
  return admin
}

function revalidateProjectSurfaces(projectId: string) {
  revalidatePath('/admin/moderation')
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/edit`)
}

async function notifyOwnerOfModeration(
  tx: Prisma.TransactionClient, actor: { id: string; displayName: string },
  eventId: string, projectId: string, description: string,
) {
  const ownerId = getSiteOwnerUserId()
  if (!ownerId || ownerId === actor.id) return
  await createNotifications(tx, [{
    recipientUserId: ownerId, sourceKey: `owner-project-moderation:${eventId}`,
    type: 'OWNER_PROJECT_MODERATION', title: '网站管理员已完成一次项目审核',
    summary: `${actor.displayName} ${description}；原审核记录可在项目详情中查看。`,
    href: `/projects/${projectId}?from=notifications`,
  }])
}

export async function approveProjectAction(
  _prevState: ModerationFormState,
  formData: FormData,
): Promise<ModerationFormState> {
  const admin = await requireAdmin()
  const projectId = projectIdSchema.safeParse(formData.get('projectId'))
  const note = moderationNoteSchema.safeParse(formData.get('note') ?? '')

  if (!projectId.success) return { error: projectId.error.issues[0].message }
  if (!note.success) return { error: note.error.issues[0].message }

  const now = new Date()

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.project.updateMany({
        where: { id: projectId.data, status: 'PENDING' },
        data: {
          status: 'PUBLISHED',
          rejectionReason: null,
          reviewedAt: now,
          publishedAt: now,
        },
      })

      if (updated.count !== 1) throw new Error('PROJECT_NOT_PENDING')

      const event = await tx.projectModerationEvent.create({
        data: {
          projectId: projectId.data,
          moderatorId: admin.id,
          reviewType: 'INITIAL',
          action: 'APPROVED',
          note: note.data || null,
        },
      })
      await notifyOwnerOfModeration(tx, admin, event.id, projectId.data, '通过了项目首次发布')
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'PROJECT_NOT_PENDING') {
      return { error: '这个项目已经被其他审核操作处理，请刷新页面。' }
    }
    throw error
  }

  revalidateProjectSurfaces(projectId.data)
  return { success: '已审核通过并公开发布。' }
}

export async function rejectProjectAction(
  _prevState: ModerationFormState,
  formData: FormData,
): Promise<ModerationFormState> {
  const admin = await requireAdmin()
  const projectId = projectIdSchema.safeParse(formData.get('projectId'))
  const reason = rejectionReasonSchema.safeParse(formData.get('reason'))

  if (!projectId.success) return { error: projectId.error.issues[0].message }
  if (!reason.success) return { error: reason.error.issues[0].message }

  const now = new Date()

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.project.updateMany({
        where: { id: projectId.data, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          rejectionReason: reason.data,
          reviewedAt: now,
          publishedAt: null,
        },
      })

      if (updated.count !== 1) throw new Error('PROJECT_NOT_PENDING')

      const event = await tx.projectModerationEvent.create({
        data: {
          projectId: projectId.data,
          moderatorId: admin.id,
          reviewType: 'INITIAL',
          action: 'REJECTED',
          note: reason.data,
        },
      })
      await notifyOwnerOfModeration(tx, admin, event.id, projectId.data, '退回了项目首次发布')
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'PROJECT_NOT_PENDING') {
      return { error: '这个项目已经被其他审核操作处理，请刷新页面。' }
    }
    throw error
  }

  revalidateProjectSurfaces(projectId.data)
  return { success: '已退回项目，并记录原因。' }
}

export async function approveProjectRevisionAction(
  _prevState: ModerationFormState,
  formData: FormData,
): Promise<ModerationFormState> {
  const admin = await requireAdmin()
  const revisionId = projectRevisionIdSchema.safeParse(formData.get('revisionId'))
  const note = moderationNoteSchema.safeParse(formData.get('note') ?? '')

  if (!revisionId.success) return { error: revisionId.error.issues[0].message }
  if (!note.success) return { error: note.error.issues[0].message }

  const now = new Date()
  let projectId = ''

  try {
    await db.$transaction(async (tx) => {
      const revision = await tx.projectRevision.findUnique({
        where: { id: revisionId.data },
        include: { project: { select: { id: true, status: true } } },
      })

      if (!revision || revision.status !== 'PENDING') throw new Error('REVISION_NOT_PENDING')
      if (revision.project.status !== 'PUBLISHED') throw new Error('PROJECT_NOT_PUBLISHED')
      projectId = revision.projectId

      const locked = await tx.projectRevision.updateMany({
        where: { id: revision.id, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          rejectionReason: null,
          reviewedAt: now,
          reviewedById: admin.id,
        },
      })
      if (locked.count !== 1) throw new Error('REVISION_NOT_PENDING')

      await tx.project.update({
        where: { id: revision.projectId },
        data: {
          title: revision.title,
          summary: revision.summary,
          description: revision.description,
          stage: revision.stage,
          purpose: revision.purpose,
          audience: revision.audience,
          typeTags: revision.typeTags,
          seekingTags: revision.seekingTags,
          platforms: revision.platforms,
          externalUrl: revision.externalUrl,
          groupType: revision.groupType,
          groupContact: revision.groupContact,
          groupAccessMode: revision.groupAccessMode,
          allowIshJoinGroup: revision.allowIshJoinGroup,
          version: revision.version,
          reviewedAt: now,
          rejectionReason: null,
        },
      })

      const event = await tx.projectModerationEvent.create({
        data: {
          projectId: revision.projectId,
          moderatorId: admin.id,
          revisionId: revision.id,
          reviewType: 'UPDATE',
          action: 'APPROVED',
          note: note.data || null,
        },
      })
      await notifyOwnerOfModeration(tx, admin, event.id, revision.projectId, '通过了项目修改再审')
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'REVISION_NOT_PENDING') {
      return { error: '这份修改已经被其他审核操作处理，请刷新页面。' }
    }
    if (error instanceof Error && error.message === 'PROJECT_NOT_PUBLISHED') {
      return { error: '线上项目当前不是已发布状态，不能切换修改版本。' }
    }
    throw error
  }

  revalidateProjectSurfaces(projectId)
  return { success: '修改审核通过，新版本已经替换线上内容。' }
}

export async function rejectProjectRevisionAction(
  _prevState: ModerationFormState,
  formData: FormData,
): Promise<ModerationFormState> {
  const admin = await requireAdmin()
  const revisionId = projectRevisionIdSchema.safeParse(formData.get('revisionId'))
  const reason = rejectionReasonSchema.safeParse(formData.get('reason'))

  if (!revisionId.success) return { error: revisionId.error.issues[0].message }
  if (!reason.success) return { error: reason.error.issues[0].message }

  const now = new Date()
  let projectId = ''

  try {
    await db.$transaction(async (tx) => {
      const revision = await tx.projectRevision.findUnique({
        where: { id: revisionId.data },
        select: { id: true, projectId: true, status: true },
      })
      if (!revision || revision.status !== 'PENDING') throw new Error('REVISION_NOT_PENDING')
      projectId = revision.projectId

      const updated = await tx.projectRevision.updateMany({
        where: { id: revision.id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          rejectionReason: reason.data,
          reviewedAt: now,
          reviewedById: admin.id,
        },
      })
      if (updated.count !== 1) throw new Error('REVISION_NOT_PENDING')

      const event = await tx.projectModerationEvent.create({
        data: {
          projectId: revision.projectId,
          moderatorId: admin.id,
          revisionId: revision.id,
          reviewType: 'UPDATE',
          action: 'REJECTED',
          note: reason.data,
        },
      })
      await notifyOwnerOfModeration(tx, admin, event.id, revision.projectId, '退回了项目修改再审')
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'REVISION_NOT_PENDING') {
      return { error: '这份修改已经被其他审核操作处理，请刷新页面。' }
    }
    throw error
  }

  revalidateProjectSurfaces(projectId)
  return { success: '已退回这份修改，当前线上版本保持不变。' }
}
