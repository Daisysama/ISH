import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'

/** 处分仅阻止写操作；登录、查看历史、收消息和本人申诉仍可使用。 */
export type WritingKind = 'POSTING' | 'PROJECTS' | 'RESPONSES' | 'COMMENTS' | 'MANAGE'

export async function getWritingUser(kind: WritingKind = 'POSTING') {
  const user = await getCurrentUser()
  if (!user) return null
  const scopes = kind === 'MANAGE' ? ['ACCOUNT', 'SITE']
    : kind === 'PROJECTS' ? ['PROJECTS', 'POSTING', 'ACCOUNT', 'SITE']
      : kind === 'RESPONSES' ? ['RESPONSES', 'POSTING', 'ACCOUNT', 'SITE']
        : kind === 'COMMENTS' ? ['COMMENTS', 'POSTING', 'ACCOUNT', 'SITE']
          : ['POSTING', 'ACCOUNT', 'SITE']
  const restriction = await db.userSanction.findFirst({ where: {
    targetId: user.id, status: 'ACTIVE',
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    scope: { in: scopes as ('POSTING' | 'PROJECTS' | 'RESPONSES' | 'COMMENTS' | 'ACCOUNT' | 'SITE')[] },
  }, select: { id: true } })
  if (restriction) redirect('/account/limited')
  return user
}
