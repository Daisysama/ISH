'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getCurrentUser } from '@/backend/auth/current-user'
import { getWritingUser } from '@/backend/auth/write-access'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'
import { PROJECT_RESPONSE_LIMITS, getProjectResponseOptions, projectAcceptsResponses } from '@/core/responses/project-response'

const responseInput = z.object({
  projectId: z.string().uuid(),
  roles: z.array(z.string().trim().min(1).max(PROJECT_RESPONSE_LIMITS.roleMax)).min(1).max(PROJECT_RESPONSE_LIMITS.maxRoles),
  message: z.string().trim().min(PROJECT_RESPONSE_LIMITS.messageMin).max(PROJECT_RESPONSE_LIMITS.messageMax),
})

const responseIdInput = z.string().uuid()

function dedupe(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

export async function submitProjectResponseAction(input: z.infer<typeof responseInput>) {
  const user = await getWritingUser('RESPONSES')
  if (!user) redirect('/login')

  const parsed = responseInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: '这声咩还没有准备好，请检查选择后再试。' }

  const project = await db.project.findFirst({
    where: { id: parsed.data.projectId, status: 'PUBLISHED' },
    select: { id: true, creatorId: true, purpose: true, seekingTags: true, groupAccessMode: true },
  })
  if (!project) return { ok: false, error: '这个项目现在无法响应。' }
  if (project.creatorId === user.id) return { ok: false, error: '这是您自己的项目，不需要给自己回一声咩。' }
  if (!projectAcceptsResponses(project)) return { ok: false, error: '这个项目目前没有开放行动响应。' }

  const allowed = new Set(getProjectResponseOptions(project))
  const roles = dedupe(parsed.data.roles).filter(role => allowed.has(role)).slice(0, PROJECT_RESPONSE_LIMITS.maxRoles)
  if (roles.length === 0) return { ok: false, error: '请至少选择一种您想响应的方式。' }

  const existing = await db.projectResponse.findUnique({
    where: { projectId_responderId: { projectId: project.id, responderId: user.id } },
    select: { id: true, status: true, membership: { select: { status: true } } },
  })
  if (existing?.membership?.status === 'REMOVED') return { ok: false, error: '您已被项目方移出，当前不能直接重新响应。' }
  if (existing?.status === 'APPROVED' && existing.membership?.status === 'ACTIVE') return { ok: false, error: '您已经是这个项目的同行者，不需要重复提交。' }
  if (existing?.status === 'PENDING') return { ok: false, error: '这声咩已经送到了，先等创作者回应吧。' }

  const saved = await db.$transaction(async tx => {
    const response = await tx.projectResponse.upsert({
    where: { projectId_responderId: { projectId: project.id, responderId: user.id } },
    update: {
      roles,
      message: parsed.data.message,
      status: 'PENDING',
      decisionNote: null,
      reviewedAt: null,
      responderDecisionSeenAt: null,
    },
    create: {
      projectId: project.id,
      responderId: user.id,
      roles,
      message: parsed.data.message,
    },
      select: { id: true, updatedAt: true },
    })
    await createNotifications(tx, [{
      recipientUserId: project.creatorId,
      sourceKey: `project-response:${response.id}:${response.updatedAt.toISOString()}`,
      type: 'PROJECT_RESPONSE_RECEIVED', title: '有人回应了您的咩',
      summary: `${user.displayName} 想加入您的项目；请到回应中心查看申请和画像。`,
      href: `/dashboard/responses#response-${response.id}`,
    }])
    return response
  })

  revalidatePath(`/projects/${project.id}`)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/responses')
  revalidatePath('/notifications')
  return { ok: true, responseId: saved.id }
}

export async function withdrawProjectResponseAction(responseId: string) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const parsed = responseIdInput.safeParse(responseId)
  if (!parsed.success) return { ok: false, error: '这声咩现在无法撤回。' }

  const response = await db.projectResponse.findFirst({
    where: { id: parsed.data, responderId: user.id },
    select: { id: true, projectId: true, status: true },
  })
  if (!response) return { ok: false, error: '没有找到这声响应。' }
  if (response.status !== 'PENDING') return { ok: false, error: '只有等待中的响应可以撤回。' }

  await db.projectResponse.update({
    where: { id: response.id },
    data: { status: 'WITHDRAWN', reviewedAt: new Date() },
  })
  revalidatePath(`/projects/${response.projectId}`)
  revalidatePath('/dashboard/responses')
  revalidatePath('/dashboard')
  revalidatePath('/notifications')
  return { ok: true }
}

export async function decideProjectResponseAction(responseId: string, decision: 'APPROVED' | 'REJECTED') {
  const user = await getWritingUser('MANAGE')
  if (!user) redirect('/login')
  const parsed = responseIdInput.safeParse(responseId)
  if (!parsed.success) return { ok: false, error: '这声响应现在无法处理。' }

  const response = await db.projectResponse.findUnique({
    where: { id: parsed.data },
    select: {
      id: true,
      projectId: true,
      responderId: true,
      roles: true,
      status: true,
      responder: { select: { displayName: true } },
      project: { select: { creatorId: true } },
    },
  })
  if (!response || response.project.creatorId !== user.id) return { ok: false, error: '您没有权限处理这声响应。' }
  if (response.status !== 'PENDING') return { ok: false, error: '这声响应已经处理过了。' }

  const reviewedAt = new Date()
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.projectResponse.updateMany({
      where: { id: response.id, status: 'PENDING' },
      data: { status: decision, reviewedAt, responderDecisionSeenAt: null },
    })
    if (result.count !== 1) return false

    if (decision === 'APPROVED') {
      await tx.projectMembership.upsert({
        where: { projectId_userId: { projectId: response.projectId, userId: response.responderId } },
        update: {
          roles: response.roles,
          permissions: [],
          status: 'ACTIVE',
          sourceResponseId: response.id,
          joinedAt: reviewedAt,
          leftAt: null,
          departureReason: null,
          removedByUserId: null,
        },
        create: {
          projectId: response.projectId,
          userId: response.responderId,
          roles: response.roles,
          permissions: [],
          status: 'ACTIVE',
          sourceResponseId: response.id,
          joinedAt: reviewedAt,
        },
      })

      await tx.projectActivity.create({
        data: {
          projectId: response.projectId,
          actorUserId: user.id,
          type: 'MEMBER_JOINED',
          summary: `${response.responder.displayName} 加入了项目`,
          metadata: { roles: response.roles },
        },
      })
    }

    return true
  })

  if (!updated) return { ok: false, error: '这声响应已经被处理，请刷新后再试。' }
  revalidatePath(`/projects/${response.projectId}`)
  revalidatePath('/dashboard/responses')
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function markOutgoingResponseDecisionsSeenAction() {
  const user = await getCurrentUser()
  if (!user) return { ok: false }

  await db.projectResponse.updateMany({
    where: {
      responderId: user.id,
      status: { in: ['APPROVED', 'REJECTED'] },
      responderDecisionSeenAt: null,
    },
    data: { responderDecisionSeenAt: new Date() },
  })

  // 回应中心自己不需要因为“已读”重新刷新；只让 Dashboard 的提示数在下次进入时更新。
  revalidatePath('/dashboard')
  return { ok: true }
}
