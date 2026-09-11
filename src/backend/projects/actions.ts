'use server'

import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { projectSubmissionSchema } from '@/core/meow/project'
import type { ProjectFormState } from '@/shared/project'

export async function createProjectAction(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const parsed = projectSubmissionSchema.safeParse({
    title: formData.get('title'),
    summary: formData.get('summary'),
    description: formData.get('description'),
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
    },
    select: { id: true },
  })

  // 新项目默认 PENDING。创建后先进入自己的项目页预览，公开访问需等审核通过。
  redirect(`/projects/${project.id}`)
}
