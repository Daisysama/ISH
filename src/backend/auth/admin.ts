import { getCurrentUser } from '@/backend/auth/current-user'
import { normalizeEmail } from '@/backend/auth/password'

/**
 * v0.2 Alpha 的最小管理员授权。
 *
 * 当前只有极少数管理员，因此先通过服务端环境变量 ADMIN_EMAILS 管理，
 * 不在客户端暴露，也不把“管理员”硬编码进代码仓库。
 *
 * 示例：ADMIN_EMAILS="alice@example.com,bob@example.com"
 *
 * 后续成员规模扩大后，应替换为数据库 RBAC / 权限表。
 */
function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => normalizeEmail(email))
      .filter(Boolean),
  )
}

export function isAdminEmail(email: string): boolean {
  return getAdminEmails().has(normalizeEmail(email))
}

export async function getCurrentAdmin() {
  const user = await getCurrentUser()
  if (!user || !isAdminEmail(user.email)) return null
  return user
}
