import { revalidatePath } from 'next/cache'

export function refreshComments(projectId: string) {
  for (const path of [`/projects/${projectId}`, `/projects/${projectId}/discussion`, `/projects/${projectId}/updates`,
    '/admin/comments', '/admin/reports', '/admin/users', '/reports', '/notifications']) revalidatePath(path)
}
