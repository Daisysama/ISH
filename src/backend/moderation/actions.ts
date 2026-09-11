'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentAdmin } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import {
  moderationNoteSchema,
  projectIdSchema,
  rejectionReasonSchema,
} from '@/core/meow/project'
import type { ModerationFormState } from '@/shared/project'

async function requireAdmin() {
  const admin = await getCurrentAdmin()
  if (!admin) throw new Error('FORBIDDEN')
  return admin
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

      if (updated.count !== 1) {
        throw new Error('PROJECT_NOT_PENDING')
      }

      await tx.projectModerationEvent.create({
        data: {
          projectId: projectId.data,
          moderatorId: admin.id,
          action: 'APPROVED',
          note: note.data || null,
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'PROJECT_NOT_PENDING') {
      return { error: '这个项目已经被其他审核操作处理，请刷新页面。' }
    }
    throw error
  }

  revalidatePath('/admin/moderation')
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  revalidatePath(`/projects/${projectId.data}`)
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

      if (updated.count !== 1) {
        throw new Error('PROJECT_NOT_PENDING')
      }

      await tx.projectModerationEvent.create({
        data: {
          projectId: projectId.data,
          moderatorId: admin.id,
          action: 'REJECTED',
          note: reason.data,
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'PROJECT_NOT_PENDING') {
      return { error: '这个项目已经被其他审核操作处理，请刷新页面。' }
    }
    throw error
  }

  revalidatePath('/admin/moderation')
  revalidatePath(`/projects/${projectId.data}`)
  revalidatePath('/dashboard')
  return { success: '已退回项目，并记录原因。' }
}
