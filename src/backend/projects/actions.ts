'use server'

import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import {
  mergeTags,
  parseCustomTags,
  projectSubmissionSchema,
} from '@/core/meow/project'
import type { ProjectFormState } from '@/shared/project'

export async function createProjectAction(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const typeTags = mergeTags(
    formData.getAll('typeTags'),
    parseCustomTags(formData.get('customTypeTags')),
    8,
  )
  const seekingTags = mergeTags(
    formData.getAll('seekingTags'),
    parseCustomTags(formData.get('customSeekingTags')),
    8,
  )
  const platforms = mergeTags(formData.getAll('platforms'), [], 5)

  const parsed = projectSubmissionSchema.safeParse({
    title: formData.get('title'),
    summary: formData.get('summary'),
    description: formData.get('description') ?? '',
    stage: formData.get('stage'),
    purpose: formData.get('purpose'),
    audience: formData.get('audience'),
    typeTags,
    seekingTags,
    platforms,
    externalUrl: formData.get('externalUrl') ?? '',
    groupType: formData.get('groupType') ?? '',
    groupAccessMode: formData.get('groupAccessMode') ?? 'PRIVATE',
    groupContact: formData.get('groupContact') ?? '',
    allowIshJoinGroup: formData.get('allowIshJoinGroup') === 'on',
  })

  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      error: first.message,
      field: first.path[0] as ProjectFormState['field'],
    }
  }

  const project = await db.project.create({
    data: {
      creatorId: user.id,
      title: parsed.data.title,
      summary: parsed.data.summary,
      description: parsed.data.description,
      stage: parsed.data.stage,
      purpose: parsed.data.purpose,
      audience: parsed.data.audience,
      typeTags: parsed.data.typeTags,
      seekingTags: parsed.data.seekingTags,
      platforms: parsed.data.platforms,
      externalUrl: parsed.data.externalUrl,
      groupType: parsed.data.groupType,
      groupAccessMode: parsed.data.groupAccessMode,
      groupContact: parsed.data.groupContact,
      allowIshJoinGroup: parsed.data.allowIshJoinGroup,
    },
    select: { id: true },
  })

  // 新项目默认 PENDING。创建后先进入自己的项目页预览，公开访问需等审核通过。
  redirect(`/projects/${project.id}`)
}
