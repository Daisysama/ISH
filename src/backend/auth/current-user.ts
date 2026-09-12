import { db } from '@/backend/database/client'
import { readSession } from '@/backend/auth/session'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * 取当前登录用户。没登录返回 null。
 *
 * 这里会真实查询数据库，而不是直接相信 cookie 中的 user id：
 * 即使 token 尚未过期，账号也可能已经被删除或失效。
 */
export async function getCurrentUser() {
  const userId = await readSession()
  if (!userId) return null

  // SITE 停用期间保留本人处分、消息和独立申诉入口；其他页面与写动作均不开放。
  const path = (await headers()).get('x-ish-request-path') ?? ''
  if (!['/account/limited', '/notifications'].includes(path)) {
    const closed = await db.userSanction.findFirst({ where: { targetId: userId, scope: 'SITE', status: 'ACTIVE',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true } })
    if (closed) redirect('/account/limited')
  }

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
