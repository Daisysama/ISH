import { db } from '@/backend/database/client'

/** Public resume is opt-in profile text and published project participation only. */
export async function getPublicUserResume(userId: string, viewerId?: string) {
  const [user, blocked] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: {
      id: true, uid: true, displayName: true, createdAt: true, publicProfileEnabled: true, skillTags: true,
      profileBio: true, experienceText: true, portfolioUrl: true,
      createdProjects: { where: { status: 'PUBLISHED' }, orderBy: { publishedAt: 'desc' }, take: 30,
        select: { id: true, title: true, summary: true } },
      projectMemberships: { where: { status: 'ACTIVE', project: { status: 'PUBLISHED' } },
        orderBy: { joinedAt: 'desc' }, take: 30,
        select: { roles: true, project: { select: { id: true, title: true, summary: true } } } },
    } }),
    viewerId && viewerId !== userId ? db.userBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: viewerId, blockedId: userId } }, select: { active: true },
    }) : Promise.resolve(null),
  ])
  return user ? { ...user, blocked: blocked?.active ?? false } : null
}
