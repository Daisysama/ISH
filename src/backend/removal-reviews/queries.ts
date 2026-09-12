import { db } from '@/backend/database/client'

/** 只统计当前用户有权处理或本人尚未查看的结果；不向项目发起人泄露平台申诉。 */
export async function getRemovalReviewNoticeCounts(userId: string, isAdmin: boolean) {
  const [founderPending, newResults, platformPending] = await Promise.all([
    db.projectRemovalReview.count({
      where: { recipient: 'FOUNDER', status: 'PENDING', project: { creatorId: userId } },
    }),
    db.projectRemovalReview.count({
      where: {
        appellantUserId: userId, status: 'RESOLVED', appellantDecisionSeenAt: null,
      },
    }),
    isAdmin
      ? db.projectRemovalReview.count({
        where: {
          recipient: 'PLATFORM', status: 'PENDING',
          appellantUserId: { not: userId }, project: { creatorId: { not: userId } },
          events: { none: { type: 'REOPENED', OR: [{ actorUserId: userId }, { deciderUserIdSnapshot: userId }] } },
        },
      })
      : Promise.resolve(0),
  ])
  return { founderPending, newResults, platformPending }
}

/** 首页只展示本人的新结果及发起人自己的待核查案件入口。 */
export async function getRemovalReviewDashboardNotices(userId: string) {
  const [results, founderPending] = await Promise.all([
    db.projectRemovalReview.findMany({
      where: { appellantUserId: userId, status: 'RESOLVED', appellantDecisionSeenAt: null },
      orderBy: { decidedAt: 'desc' },
      select: { id: true, recipient: true, project: { select: { id: true, title: true } } },
    }),
    db.projectRemovalReview.findMany({
      where: { recipient: 'FOUNDER', status: 'PENDING', project: { creatorId: userId } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, project: { select: { id: true, title: true } } },
    }),
  ])
  return { results, founderPending }
}
