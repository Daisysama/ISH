import { revalidatePath } from 'next/cache'

/** 项目下架 / 恢复同时刷新发现页、工作台及各当事人的私人消息。 */
export function refreshProjectReports(projectId: string) {
  for (const path of ['/admin/reports', '/admin/staff', '/reports', '/dashboard', '/projects', '/notifications', `/projects/${projectId}`]) revalidatePath(path)
}
