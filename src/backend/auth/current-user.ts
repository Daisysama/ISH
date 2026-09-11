import { db } from '@/backend/database/client'
import { readSession } from '@/backend/auth/session'

/**
 * 取当前登录用户。没登录返回 null。
 *
 * 这里会真实查询数据库，而不是直接相信 cookie 中的 user id：
 * 即使 token 尚未过期，账号也可能已经被删除或失效。
 */
export async function getCurrentUser() {
  const userId = await readSession()
  if (!userId) return null

  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      createdAt: true,
    },
  })
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
