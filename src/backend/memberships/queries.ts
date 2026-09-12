import { db } from '@/backend/database/client'

/**
 * 读取某个用户当前仍然有效的项目同行关系。
 *
 * Dashboard 用它区分“我发起的”和“我同行的”；这里只返回 ACTIVE 成员，
 * 历史上的退出 / 移除关系继续保留在数据库中，但不再赋予项目访问能力。
 */
export function listActiveMembershipsForUser(userId: string) {
  return db.projectMembership.findMany({
    where: { userId, status: 'ACTIVE' },
    orderBy: { joinedAt: 'desc' },
    select: {
      id: true,
      roles: true,
      permissions: true,
      joinedAt: true,
      removalReviews: {
        where: { recipient: 'PLATFORM' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { status: true },
      },
      removalRecords: {
        orderBy: { removedAt: 'desc' },
        take: 1,
        select: { id: true },
      },
      project: {
        select: {
          id: true,
          title: true,
          summary: true,
          status: true,
          creator: {
            select: {
              id: true,
              uid: true,
              displayName: true,
            },
          },
        },
      },
    },
  })
}

/** 历史仅属于成员本人；不再赋予内部资料/团队页权限。 */
export function listHistoricalMembershipsForUser(userId: string) {
  return db.projectMembership.findMany({
    where: { userId, status: { in: ['LEFT', 'REMOVED'] } },
    orderBy: { leftAt: 'desc' },
    select: {
      id: true, status: true, leftAt: true, departureReason: true,
      removedBy: { select: { displayName: true } },
      removalReviews: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, recipient: true, status: true, decision: true, removedAt: true,
        },
      },
      project: {
        select: {
          id: true, title: true, summary: true, status: true,
          creator: { select: { displayName: true } },
        },
      },
    },
  })
}

/**
 * 判断某个用户是否仍是指定项目的有效同行者。
 * 响应历史不能充当权限凭证；只有 ACTIVE membership 才能解锁成员能力。
 */
export function getActiveProjectMembership(projectId: string, userId: string) {
  return db.projectMembership.findFirst({
    where: { projectId, userId, status: 'ACTIVE' },
  })
}

/**
 * 读取用户与项目的成员关系，包括已经退出 / 被移除的历史状态。
 * 项目详情用它向本人解释“为什么我已经不是同行者”，而不是把状态静默消失。
 */
export function getProjectMembershipForUser(projectId: string, userId: string) {
  return db.projectMembership.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: {
      id: true,
      status: true,
      roles: true,
      permissions: true,
      joinedAt: true,
      leftAt: true,
      departureReason: true,
      removedBy: { select: { displayName: true } },
      removalReviews: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, removedAt: true, recipient: true, status: true,
          decision: true, decisionReason: true, decidedAt: true,
        },
      },
      removalRecords: {
        orderBy: { removedAt: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  })
}

/**
 * 项目团队页。只有发起人或 ACTIVE 同行者可以看到完整团队与内部活动流。
 */
export async function getProjectTeamState(projectId: string, viewerId: string) {
  const [project, viewerMembership] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        creatorId: true,
        creator: { select: { displayName: true } },
      },
    }),
    db.projectMembership.findUnique({
      where: { projectId_userId: { projectId, userId: viewerId } },
      select: { id: true, status: true },
    }),
  ])

  if (!project) return null
  const isOwner = project.creatorId === viewerId
  if (!isOwner && viewerMembership?.status !== 'ACTIVE') return null

  const [memberships, activities, removalReviews, removedMemberships] = await Promise.all([
    db.projectMembership.findMany({
      where: { projectId, status: 'ACTIVE' }, orderBy: { joinedAt: 'asc' },
      select: {
        id: true, userId: true, roles: true, permissions: true, joinedAt: true,
        user: { select: {
          id: true, uid: true, displayName: true, skillTags: true, likeTags: true, dislikeTags: true,
          profileBio: true, experienceText: true, portfolioUrl: true,
          projectMemberships: { where: { status: 'ACTIVE', project: { status: 'PUBLISHED' } },
            orderBy: { joinedAt: 'desc' }, take: 30,
            select: { roles: true, project: { select: { id: true, title: true } } } },
        } },
      },
    }),
    db.projectActivity.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        summary: true,
        reason: true,
        createdAt: true,
        actor: { select: { displayName: true } },
      },
    }),
    isOwner ? db.projectRemovalReview.findMany({
      where: { projectId, recipient: 'FOUNDER', status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, removedAt: true, category: true, statement: true, createdAt: true,
        appellant: { select: { displayName: true } },
      },
    }) : Promise.resolve([]),
    isOwner ? db.projectMembership.findMany({
      where: { projectId, status: 'REMOVED' },
      orderBy: { leftAt: 'desc' },
      select: {
        id: true, leftAt: true, departureReason: true,
        user: { select: { displayName: true } },
      },
    }) : Promise.resolve([]),
  ])

  return { ...project, memberships, viewerMembership, activities, removalReviews, removedMemberships }
}
