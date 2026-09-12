import { db } from '@/backend/database/client'
import type { ProjectUpdate } from '@prisma/client'

/** 对外只读 PUBLISHED，待审与退回只给本人或项目发起人。 */
export async function getProjectUpdatePageState(projectId: string, viewerId?: string, focusId?: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true, title: true, status: true, creatorId: true,
      creator: { select: { displayName: true } },
    },
  })
  if (!project) return null
  const isCreator = Boolean(viewerId && viewerId === project.creatorId)
  if (project.status !== 'PUBLISHED' && !isCreator) return null
  const membership = viewerId && !isCreator ? await db.projectMembership.findUnique({
    where: { projectId_userId: { projectId, userId: viewerId } },
    select: { status: true, permissions: true },
  }) : null
  const canSubmit = project.status === 'PUBLISHED' && (isCreator || (membership?.status === 'ACTIVE' && membership.permissions.includes('SUBMIT_UPDATES')))
  const [published, ownUnpublished, blocks] = await Promise.all([
    project.status === 'PUBLISHED' ? db.projectUpdate.findMany({
      where: { projectId, status: 'PUBLISHED' },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }], take: 50,
      select: { id: true, title: true, body: true, authorId: true, authorNameSnapshot: true, publishedAt: true },
    }) : Promise.resolve([]),
    viewerId && (isCreator || membership) ? db.projectUpdate.findMany({
      where: { projectId, status: { in: ['PENDING', 'REJECTED', 'HIDDEN'] }, ...(isCreator ? {} : { authorId: viewerId }) },
      orderBy: { submittedAt: 'desc' }, take: 30,
      select: {
        id: true, title: true, body: true, status: true, rejectionReason: true, authorId: true,
        authorNameSnapshot: true, submittedAt: true, scan: { select: { result: true } },
        hiddenAppeals: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, decision: true, decisionReason: true } },
      },
    }) : Promise.resolve([]),
    viewerId ? db.userBlock.findMany({ where: { blockerId: viewerId, active: true }, select: { blockedId: true } }) : Promise.resolve([]),
  ])
  const publicItems: Pick<ProjectUpdate, 'id' | 'title' | 'body' | 'authorId' | 'authorNameSnapshot' | 'publishedAt'>[] = [...published]
  if (focusId && project.status === 'PUBLISHED' && !publicItems.some(item => item.id === focusId)) {
    const focused = await db.projectUpdate.findFirst({ where: { id: focusId, projectId, status: 'PUBLISHED' },
      select: { id: true, title: true, body: true, authorId: true, authorNameSnapshot: true, publishedAt: true } })
    if (focused) publicItems.unshift(focused)
  }
  return { ...project, canSubmit, isCreator, published: publicItems, ownUnpublished, blockedUserIds: blocks.map(item => item.blockedId) }
}

/** 退回原件不可改；仅作者本人可用其内容作为新动态的起稿。 */
export function getRejectedUpdateDraft(projectId: string, updateId: string, authorId: string) {
  return db.projectUpdate.findFirst({
    where: { id: updateId, projectId, authorId, status: 'REJECTED' },
    select: { title: true, body: true },
  })
}

/** 打开某条审核项的历史时必须再次判断网站管理权限。 */
export function getUpdateModerationRecord(updateId: string) {
  return db.projectUpdate.findUnique({
    where: { id: updateId },
    include: {
      scan: { select: { result: true, matchedRules: true } },
      project: { select: { id: true, title: true, status: true, creatorId: true } },
      reviewedBy: { select: { displayName: true } },
      events: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, type: true, note: true, createdAt: true, actorUserId: true, previousStatus: true,
          previousReasonSnapshot: true, previousReviewedAtSnapshot: true, previousReviewerIdSnapshot: true,
          actor: { select: { displayName: true } },
        },
      },
    },
  })
}
