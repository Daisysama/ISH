'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { getWritingUser } from '@/backend/auth/write-access'
import { db } from '@/backend/database/client'
import {
  mergeTags,
  parseCustomTags,
  projectIdSchema,
  projectSubmissionSchema,
} from '@/core/meow/project'
import type { ProjectFormState, ProjectFormValues } from '@/shared/project'

function stringValue(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

function stringValues(formData: FormData, name: string) {
  return formData.getAll(name).filter((value): value is string => typeof value === 'string')
}

function snapshotProjectForm(formData: FormData): ProjectFormValues {
  return {
    title: stringValue(formData, 'title'),
    summary: stringValue(formData, 'summary'),
    description: stringValue(formData, 'description'),
    stage: (stringValue(formData, 'stage') || 'IDEA') as ProjectFormValues['stage'],
    purpose: (stringValue(formData, 'purpose') || 'COLLABORATE') as ProjectFormValues['purpose'],
    audience: (stringValue(formData, 'audience') || 'EVERYONE') as ProjectFormValues['audience'],
    typeTags: stringValues(formData, 'typeTags'),
    customTypeTags: parseCustomTags(formData.get('customTypeTags')),
    seekingTags: stringValues(formData, 'seekingTags'),
    customSeekingTags: parseCustomTags(formData.get('customSeekingTags')),
    platforms: stringValues(formData, 'platforms'),
    externalUrl: stringValue(formData, 'externalUrl'),
    groupType: stringValue(formData, 'groupType'),
    groupContact: stringValue(formData, 'groupContact'),
    groupAccessMode: (stringValue(formData, 'groupAccessMode') || 'PRIVATE') as ProjectFormValues['groupAccessMode'],
    allowIshJoinGroup: formData.get('allowIshJoinGroup') === 'on',
  }
}

function validateProjectForm(formData: FormData) {
  const values = snapshotProjectForm(formData)
  const typeTags = mergeTags(values.typeTags, values.customTypeTags, 16)
  const seekingTags = mergeTags(values.seekingTags, values.customSeekingTags, 12)
  const platforms = mergeTags(values.platforms, [], 5)

  const parsed = projectSubmissionSchema.safeParse({
    title: values.title,
    summary: values.summary,
    description: values.description,
    stage: values.stage,
    purpose: values.purpose,
    audience: values.audience,
    typeTags,
    seekingTags,
    platforms,
    externalUrl: values.externalUrl,
    groupType: values.groupType,
    groupAccessMode: values.groupAccessMode,
    groupContact: values.groupContact,
    allowIshJoinGroup: values.allowIshJoinGroup,
  })

  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const state: ProjectFormState = {
      error: first.message,
      field: first.path[0] as ProjectFormState['field'],
      values,
      attempt: `${Date.now()}`,
    }
    return { ok: false as const, state }
  }

  return { ok: true as const, values, data: parsed.data }
}

export async function createProjectAction(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const user = await getWritingUser('PROJECTS')
  if (!user) redirect('/login')

  const result = validateProjectForm(formData)
  if (!result.ok) return result.state

  const project = await db.project.create({
    data: {
      creatorId: user.id,
      title: result.data.title,
      summary: result.data.summary,
      description: result.data.description,
      stage: result.data.stage,
      purpose: result.data.purpose,
      audience: result.data.audience,
      typeTags: result.data.typeTags,
      seekingTags: result.data.seekingTags,
      platforms: result.data.platforms,
      externalUrl: result.data.externalUrl,
      groupType: result.data.groupType,
      groupAccessMode: result.data.groupAccessMode,
      groupContact: result.data.groupContact,
      allowIshJoinGroup: result.data.allowIshJoinGroup,
    },
    select: { id: true },
  })

  // 新项目默认 PENDING。创建后先进入自己的项目页预览，公开访问需等审核通过。
  redirect(`/projects/${project.id}?from=dashboard`)
}

export async function submitProjectRevisionAction(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const user = await getWritingUser('PROJECTS')
  if (!user) redirect('/login')

  const values = snapshotProjectForm(formData)
  const projectId = projectIdSchema.safeParse(formData.get('projectId'))
  if (!projectId.success) {
    return { error: '项目不存在或链接已经失效。', values, attempt: `${Date.now()}` }
  }

  const result = validateProjectForm(formData)
  if (!result.ok) return result.state

  const project = await db.project.findFirst({
    where: { id: projectId.data, creatorId: user.id },
    select: { id: true, status: true, version: true },
  })

  if (!project) {
    return { error: '没有找到这个项目，或您没有修改权限。', values, attempt: `${Date.now()}` }
  }
  if (project.status !== 'PUBLISHED') {
    return { error: '只有已经公开的项目需要走“修改再审”。', values, attempt: `${Date.now()}` }
  }

  const revisionIdRaw = stringValue(formData, 'revisionId')

  try {
    await db.$transaction(async (tx) => {
      const pending = await tx.projectRevision.findFirst({
        where: { projectId: project.id, status: 'PENDING' },
        select: { id: true },
      })
      if (pending) throw new Error('REVISION_ALREADY_PENDING')

      const data = {
        title: result.data.title,
        summary: result.data.summary,
        description: result.data.description,
        stage: result.data.stage,
        purpose: result.data.purpose,
        audience: result.data.audience,
        typeTags: result.data.typeTags,
        seekingTags: result.data.seekingTags,
        platforms: result.data.platforms,
        externalUrl: result.data.externalUrl,
        groupType: result.data.groupType,
        groupAccessMode: result.data.groupAccessMode,
        groupContact: result.data.groupContact,
        allowIshJoinGroup: result.data.allowIshJoinGroup,
      }

      if (revisionIdRaw) {
        const updated = await tx.projectRevision.updateMany({
          where: {
            id: revisionIdRaw,
            projectId: project.id,
            status: 'REJECTED',
            submittedById: user.id,
          },
          data: {
            ...data,
            status: 'PENDING',
            rejectionReason: null,
            submittedAt: new Date(),
            reviewedAt: null,
            reviewedById: null,
          },
        })
        if (updated.count !== 1) throw new Error('REVISION_NOT_EDITABLE')
      } else {
        const latest = await tx.projectRevision.aggregate({
          where: { projectId: project.id },
          _max: { version: true },
        })
        const nextVersion = Math.max(project.version + 1, (latest._max.version ?? project.version) + 1)

        await tx.projectRevision.create({
          data: {
            projectId: project.id,
            version: nextVersion,
            submittedById: user.id,
            ...data,
          },
        })
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'REVISION_ALREADY_PENDING') {
      return { error: '这个项目已经有一份修改正在审核。审核结束后再继续改，避免版本彼此覆盖。', values, attempt: `${Date.now()}` }
    }
    if (error instanceof Error && error.message === 'REVISION_NOT_EDITABLE') {
      return { error: '这份修改稿已经不是可编辑状态，请刷新页面后再试。', values, attempt: `${Date.now()}` }
    }
    throw error
  }

  revalidatePath('/dashboard')
  revalidatePath('/admin/moderation')
  revalidatePath(`/projects/${project.id}`)
  revalidatePath(`/projects/${project.id}/edit`)
  redirect(`/projects/${project.id}/edit?submitted=1`)
}
