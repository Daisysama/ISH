import { z } from 'zod'
import { db } from '@/backend/database/client'

/** Short UID is the public reference; old UUID links continue to work for historical notifications. */
export async function resolveUserId(reference: string) {
  if (z.string().uuid().safeParse(reference).success) return reference
  if (!/^[1-9]\d{0,9}$/.test(reference)) return null
  const uid = Number(reference)
  if (!Number.isSafeInteger(uid) || uid > 2147483647) return null
  const user = await db.user.findUnique({ where: { uid }, select: { id: true } })
  return user?.id ?? null
}
