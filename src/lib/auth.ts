import bcrypt from 'bcryptjs'

import { db } from '@/lib/db'
import { readSession } from '@/lib/session'

/** bcrypt 只看密码的前 72 字节，超过的部分会被悄悄截断，所以在入口就拦掉。 */
export const MAX_PASSWORD_BYTES = 72

/** 计算轮数。10 在本机大约 60ms —— 够慢到让暴力破解难受，又不至于让登录卡顿。 */
const BCRYPT_ROUNDS = 10

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/** 邮箱统一小写，避免大小写不同被当成两个账号。 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * 取当前登录用户。没登录返回 null。
 *
 * 注意这里会真的查一次数据库，而不是直接信 cookie 里的内容 ——
 * 因为账号可能已经被删了，但对方手里的 token 还没过期。
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
