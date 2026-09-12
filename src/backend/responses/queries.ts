import { db } from '@/backend/database/client'

export function getProjectResponseForResponder(projectId: string, responderId: string) {
  return db.projectResponse.findUnique({
    where: { projectId_responderId: { projectId, responderId } },
    select: {
      id: true,
      roles: true,
      message: true,
      status: true,
      decisionNote: true,
      createdAt: true,
      updatedAt: true,
      responderDecisionSeenAt: true,
    },
  })
}

export function listIncomingResponsesForCreator(creatorId: string) {
  return db.projectResponse.findMany({
    where: { project: { creatorId } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      roles: true,
      message: true,
      status: true,
      decisionNote: true,
      createdAt: true,
      updatedAt: true,
      responderDecisionSeenAt: true,
      membership: { select: { status: true } },
      project: {
        select: { id: true, title: true, groupAccessMode: true },
      },
      responder: {
        select: {
          id: true,
          uid: true,
          displayName: true,
          skillTags: true,
          likeTags: true,
          dislikeTags: true,
          profileBio: true,
          experienceText: true,
          portfolioUrl: true,
          projectMemberships: { where: { status: 'ACTIVE', project: { status: 'PUBLISHED' } },
            orderBy: { joinedAt: 'desc' }, take: 30,
            select: { roles: true, project: { select: { id: true, title: true } } } },
        },
      },
    },
  })
}

export async function listOutgoingResponsesForUser(responderId: string) {
  const responses = await db.projectResponse.findMany({
    where: { responderId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      roles: true,
      message: true,
      status: true,
      decisionNote: true,
      createdAt: true,
      updatedAt: true,
      responderDecisionSeenAt: true,
      project: {
        select: {
          id: true,
          title: true,
          summary: true,
          status: true,
          groupAccessMode: true,
          groupType: true,
          groupContact: true,
          memberships: {
            where: { userId: responderId, status: 'ACTIVE' },
            select: { id: true },
          },
        },
      },
    },
  })

  // 申请制群聊只向 ACTIVE 同行者继续传递联系方式；响应历史本身不再充当成员权限。
  return responses.map((response) => {
    const activeMember = response.project.memberships.length > 0
    const project = activeMember
      ? response.project
      : { ...response.project, groupType: null, groupContact: null }

    return { ...response, project }
  })
}

export async function getResponseCenterCounts(userId: string) {
  const [pendingIncoming, unreadOutgoing] = await Promise.all([
    db.projectResponse.count({
      where: { status: 'PENDING', project: { creatorId: userId } },
    }),
    db.projectResponse.count({
      where: {
        responderId: userId,
        status: { in: ['APPROVED', 'REJECTED'] },
        responderDecisionSeenAt: null,
      },
    }),
  ])

  return {
    pendingIncoming,
    unreadOutgoing,
    total: pendingIncoming + unreadOutgoing,
  }
}
