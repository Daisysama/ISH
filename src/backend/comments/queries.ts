import { db } from '@/backend/database/client'

/** 前台只返回本人举报的信息；他人的举报人 ID 和陈述绝不传入客户端组件。 */
export async function getDiscussion(projectId: string, updateId: string | null, viewerId: string | undefined, page: number) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, title: true, status: true,
    creatorId: true, updates: updateId ? { where: { id: updateId, status: 'PUBLISHED' }, take: 1, select: { id: true, title: true } } : false,
  } })
  if (!project || project.status !== 'PUBLISHED' || updateId && !project.updates?.length) return null
  const target = { projectId, updateId, parentId: null }
  const total = await db.projectComment.count({ where: { ...target, OR: [{ status: { in: ['VISIBLE', 'DELETED', 'HIDDEN'] } },
    ...(viewerId ? [{ authorId: viewerId, status: 'PENDING' as const }] : [])] } })
  const roots = await db.projectComment.findMany({ where: { ...target,
    OR: [{ status: { in: ['VISIBLE', 'DELETED', 'HIDDEN'] } },
      ...(viewerId ? [{ authorId: viewerId, status: 'PENDING' as const }] : [])],
  }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 30, take: 30,
  })
  const children = roots.length ? await db.projectComment.findMany({ where: { parentId: { in: roots.map(item => item.id) },
    OR: [{ status: { in: ['VISIBLE', 'DELETED', 'HIDDEN'] } },
      ...(viewerId ? [{ authorId: viewerId, status: 'PENDING' as const }] : [])],
  }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }) : []
  const all = [...roots, ...children]
  const ids = all.map(item => item.id)
  const [mine, reactions, reports, appeals, blocked] = await Promise.all([
    viewerId && ids.length ? db.projectCommentPreference.findMany({ where: { userId: viewerId, commentId: { in: ids } }, select: {
      commentId: true, reaction: true, hidden: true,
    } }) : Promise.resolve([]),
    ids.length ? db.projectCommentPreference.groupBy({ by: ['commentId', 'reaction'], where: { commentId: { in: ids }, reaction: { not: null } },
      _count: { _all: true } }) : Promise.resolve([]),
    viewerId && ids.length ? db.projectCommentReport.findMany({ where: { reporterId: viewerId, commentId: { in: ids } },
      orderBy: { createdAt: 'desc' }, select: { id: true, commentId: true, status: true, retractedAt: true,
        decision: true, decisionReason: true } }) : Promise.resolve([]),
    viewerId && ids.length ? db.projectCommentAppeal.findMany({ where: { appellantId: viewerId, commentId: { in: ids } },
      select: { commentId: true, status: true, decision: true, decisionReason: true } }) : Promise.resolve([]),
    viewerId ? db.userBlock.findMany({ where: { blockerId: viewerId, active: true }, select: { blockedId: true } }) : Promise.resolve([]),
  ])
  const prefs = new Map(mine.map(item => [item.commentId, item]))
  const likes = new Map<string, number>(), dislikes = new Map<string, number>()
  for (const item of reactions) (item.reaction === 'LIKE' ? likes : dislikes).set(item.commentId, item._count._all)
  const myReports = new Map<string, typeof reports[number]>()
  for (const item of reports) if (!myReports.has(item.commentId)) myReports.set(item.commentId, item)
  const myAppeals = new Map(appeals.map(item => [item.commentId, item]))
  const blockedIds = new Set(blocked.map(item => item.blockedId))
  const view = (item: typeof all[number]) => ({
    id: item.id, parentId: item.parentId, authorId: item.authorId, authorName: item.authorNameSnapshot,
    body: item.authorId === viewerId || item.status === 'VISIBLE' ? item.body : '',
    status: item.status, createdAt: item.createdAt, isProducer: item.authorId === project.creatorId,
    hiddenReason: item.authorId === viewerId ? item.hiddenReason : null,
    blocked: blockedIds.has(item.authorId) || Boolean(prefs.get(item.id)?.hidden),
    blockedAuthor: blockedIds.has(item.authorId), hiddenByMe: Boolean(prefs.get(item.id)?.hidden),
    reaction: prefs.get(item.id)?.reaction ?? null, likes: likes.get(item.id) ?? 0, dislikes: dislikes.get(item.id) ?? 0,
    myReport: myReports.get(item.id) ?? null, myAppeal: myAppeals.get(item.id) ?? null,
  })
  return { title: project.title, updateTitle: updateId ? project.updates?.[0]?.title : null, creatorId: project.creatorId,
    total, page, hasNext: page * 30 < total, roots: roots.map(view), replies: children.map(view) }
}
