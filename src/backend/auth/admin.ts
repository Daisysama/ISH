import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { SITE_PERMISSIONS, type SitePermission } from '@/core/governance/permissions'
import { z } from 'zod'

/** 根身份取自现有 users.id，不接受可变邮箱或显示名作为授权凭据。 */
export function getSiteOwnerUserId(): string | null {
  const value = process.env.SITE_OWNER_USER_ID?.trim()
  const parsed = z.string().uuid().safeParse(value)
  return parsed.success ? parsed.data : null
}

export function isSiteOwner(userId: string): boolean {
  return getSiteOwnerUserId() === userId
}

export async function getSiteAccess(userId: string) {
  if (isSiteOwner(userId)) return { role: 'OWNER' as const, permissions: SITE_PERMISSIONS }
  const suspended = await db.userSanction.findFirst({ where: { targetId: userId, status: 'ACTIVE', scope: { in: ['ACCOUNT', 'SITE'] },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true } })
  if (suspended) return { role: 'USER' as const, permissions: [] as string[] }
  const admin = await db.siteAdmin.findUnique({ where: { userId }, select: { active: true, permissions: true } })
  if (!admin?.active) return { role: 'USER' as const, permissions: [] as string[] }
  return { role: 'ADMIN' as const, permissions: admin.permissions }
}

export async function hasSitePermission(userId: string, permission: SitePermission) {
  const access = await getSiteAccess(userId)
  return access.permissions.includes(permission)
}

/** 默认仅授予项目审核；申诉审查与治理日志需分别显式授权。 */
export async function getCurrentAdmin(permission: SitePermission = 'PROJECT_REVIEW') {
  const user = await getCurrentUser()
  if (!user || !(await hasSitePermission(user.id, permission))) return null
  return user
}
