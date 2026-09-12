'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'

import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'

const projectPreferenceInput = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(['INTERESTED', 'NOT_INTERESTED']),
  selectedTags: z.array(z.string().trim().min(1).max(16)).max(16),
  suppressFuturePrompt: z.boolean(),
  inferFromProject: z.boolean(),
})

const projectIdInput = z.string().uuid()

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function without(values: string[], removed: Set<string>) {
  return values.filter((value) => !removed.has(value))
}

async function adjustInferredSignals(
  tx: Prisma.TransactionClient,
  userId: string,
  tags: string[],
  delta: number,
) {
  for (const tag of tags) {
    const signal = await tx.userTagSignal.findUnique({ where: { userId_tag: { userId, tag } } })
    if (!signal) continue
    const next = signal.score + delta
    if (next === 0) {
      await tx.userTagSignal.delete({ where: { id: signal.id } })
    } else {
      await tx.userTagSignal.update({ where: { id: signal.id }, data: { score: next } })
    }
  }
}

export async function saveProjectPreferenceAction(input: z.infer<typeof projectPreferenceInput>) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const parsed = projectPreferenceInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: '这次偏好没有记住，请重试。' }

  const project = await db.project.findFirst({
    where: { id: parsed.data.projectId, status: 'PUBLISHED' },
    select: { id: true, typeTags: true },
  })
  if (!project) return { ok: false, error: '这个项目现在无法记录偏好。' }

  const selected = dedupe(parsed.data.selectedTags.filter((tag) => project.typeTags.includes(tag)))
  const selectedSet = new Set(selected)
  const delta = parsed.data.kind === 'INTERESTED' ? 1 : -1

  await db.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: user.id },
      select: {
        likeTags: true,
        dislikeTags: true,
        suppressInterestedPrompt: true,
        suppressNotInterestedPrompt: true,
      },
    })
    if (!current) return

    const nextLikes = parsed.data.kind === 'INTERESTED'
      ? dedupe([...current.likeTags, ...selected])
      : without(current.likeTags, selectedSet)
    const nextDislikes = parsed.data.kind === 'NOT_INTERESTED'
      ? dedupe([...current.dislikeTags, ...selected])
      : without(current.dislikeTags, selectedSet)

    await tx.user.update({
      where: { id: user.id },
      data: {
        likeTags: nextLikes,
        dislikeTags: nextDislikes,
        suppressInterestedPrompt:
          parsed.data.kind === 'INTERESTED' && parsed.data.suppressFuturePrompt
            ? true
            : current.suppressInterestedPrompt,
        suppressNotInterestedPrompt:
          parsed.data.kind === 'NOT_INTERESTED' && parsed.data.suppressFuturePrompt
            ? true
            : current.suppressNotInterestedPrompt,
      },
    })

    await tx.projectPreference.upsert({
      where: { userId_projectId: { userId: user.id, projectId: project.id } },
      update: {
        kind: parsed.data.kind,
        selectedTags: selected,
        inferredFromProject: parsed.data.inferFromProject,
      },
      create: {
        userId: user.id,
        projectId: project.id,
        kind: parsed.data.kind,
        selectedTags: selected,
        inferredFromProject: parsed.data.inferFromProject,
      },
    })

    // 明确选择了某个标签时，它已经进入显式画像，不再保留系统猜测。
    if (selected.length > 0) {
      await tx.userTagSignal.deleteMany({ where: { userId: user.id, tag: { in: selected } } })
    }

    if (parsed.data.inferFromProject) {
      const explicit = new Set([...nextLikes, ...nextDislikes])
      const inferredTags = project.typeTags.filter((tag) => !explicit.has(tag)).slice(0, 12)
      for (const tag of inferredTags) {
        await tx.userTagSignal.upsert({
          where: { userId_tag: { userId: user.id, tag } },
          update: { score: { increment: delta }, lastSource: 'PROJECT_INTERACTION' },
          create: { userId: user.id, tag, score: delta, lastSource: 'PROJECT_INTERACTION' },
        })
      }
    }
  })

  revalidatePath('/projects')
  revalidatePath(`/projects/${project.id}`)
  revalidatePath('/profile')
  return { ok: true }
}

export async function clearProjectPreferenceAction(projectId: string) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const parsedProjectId = projectIdInput.safeParse(projectId)
  if (!parsedProjectId.success) return { ok: false, error: '这个项目无法撤销偏好。' }

  const preference = await db.projectPreference.findUnique({
    where: { userId_projectId: { userId: user.id, projectId: parsedProjectId.data } },
    include: { project: { select: { typeTags: true } } },
  })
  if (!preference) return { ok: true }

  await db.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: user.id },
      select: { likeTags: true, dislikeTags: true },
    })
    if (!current) return

    const selectedSet = new Set(preference.selectedTags)
    await tx.user.update({
      where: { id: user.id },
      data: {
        likeTags: preference.kind === 'INTERESTED' ? without(current.likeTags, selectedSet) : current.likeTags,
        dislikeTags: preference.kind === 'NOT_INTERESTED' ? without(current.dislikeTags, selectedSet) : current.dislikeTags,
      },
    })

    if (preference.inferredFromProject) {
      const direction = preference.kind === 'INTERESTED' ? -1 : 1
      const inferredTags = preference.project.typeTags.filter((tag) => !selectedSet.has(tag)).slice(0, 12)
      await adjustInferredSignals(tx, user.id, inferredTags, direction)
    }

    await tx.projectPreference.delete({ where: { id: preference.id } })
  })

  revalidatePath('/projects')
  revalidatePath(`/projects/${parsedProjectId.data}`)
  revalidatePath('/profile')
  return { ok: true }
}

async function setProjectHidden(userId: string, projectId: string, hidden: boolean) {
  if (hidden) {
    const project = await db.project.findFirst({ where: { id: projectId, status: 'PUBLISHED' }, select: { id: true } })
    if (!project) return { ok: false, error: '这个项目现在无法隐藏。' }
    await db.hiddenProject.upsert({
      where: { userId_projectId: { userId, projectId } },
      update: {},
      create: { userId, projectId },
    })
  } else {
    await db.hiddenProject.deleteMany({ where: { userId, projectId } })
  }

  revalidatePath('/projects')
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/profile')
  return { ok: true }
}

export async function hideProjectAction(projectId: string) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const parsedProjectId = projectIdInput.safeParse(projectId)
  if (!parsedProjectId.success) return { ok: false, error: '这个项目现在无法隐藏。' }
  return setProjectHidden(user.id, parsedProjectId.data, true)
}

export async function restoreHiddenProjectAction(projectId: string) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const parsedProjectId = projectIdInput.safeParse(projectId)
  if (!parsedProjectId.success) return { ok: false, error: '这个项目现在无法恢复。' }
  return setProjectHidden(user.id, parsedProjectId.data, false)
}

export async function restoreHiddenProjectFormAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const projectId = projectIdInput.safeParse(formData.get('projectId'))
  if (!projectId.success) return
  await setProjectHidden(user.id, projectId.data, false)
}

export async function removeInferredTagAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const tag = String(formData.get('tag') ?? '').trim()
  if (!tag) return

  await db.userTagSignal.deleteMany({ where: { userId: user.id, tag } })
  revalidatePath('/profile')
  revalidatePath('/projects')
}

export async function setProjectFavoriteAction(projectId: string, favorite: boolean) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const parsedProjectId = projectIdInput.safeParse(projectId)
  if (!parsedProjectId.success) return { ok: false, error: '这个项目现在无法收藏。' }

  const project = await db.project.findFirst({
    where: { id: parsedProjectId.data, status: 'PUBLISHED' },
    select: { id: true },
  })
  if (!project) return { ok: false, error: '这个项目现在无法收藏。' }

  if (favorite) {
    await db.favoriteProject.upsert({
      where: { userId_projectId: { userId: user.id, projectId: project.id } },
      update: {},
      create: { userId: user.id, projectId: project.id },
    })
  } else {
    await db.favoriteProject.deleteMany({ where: { userId: user.id, projectId: project.id } })
  }

  revalidatePath('/projects')
  revalidatePath(`/projects/${project.id}`)
  revalidatePath('/profile')
  return { ok: true }
}

export async function removeFavoriteProjectFormAction(formData: FormData) {
  const projectId = formData.get('projectId')
  if (typeof projectId !== 'string') return
  await setProjectFavoriteAction(projectId, false)
}
