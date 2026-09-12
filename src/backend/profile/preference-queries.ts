import { db } from '@/backend/database/client'

export async function getPreferenceLearningContext(userId: string) {
  const [user, projectPreferences, hiddenProjects, favoriteProjects, tagSignals] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        likeTags: true,
        dislikeTags: true,
        suppressInterestedPrompt: true,
        suppressNotInterestedPrompt: true,
      },
    }),
    db.projectPreference.findMany({
      where: { userId },
      select: { projectId: true, kind: true },
    }),
    db.hiddenProject.findMany({
      where: { userId },
      select: { projectId: true },
    }),
    db.favoriteProject.findMany({
      where: { userId },
      select: { projectId: true },
    }),
    db.userTagSignal.findMany({
      where: { userId, score: { not: 0 } },
      orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
      select: { tag: true, score: true, lastSource: true },
    }),
  ])

  if (!user) return null

  return {
    ...user,
    projectPreferences,
    tagSignals,
    hiddenProjectIds: hiddenProjects.map((item) => item.projectId),
    favoriteProjectIds: favoriteProjects.map((item) => item.projectId),
  }
}

export function listHiddenProjectsForUser(userId: string) {
  return db.hiddenProject.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      projectId: true,
      project: { select: { title: true, summary: true } },
    },
  })
}


export function listFavoriteProjectsForUser(userId: string) {
  return db.favoriteProject.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      projectId: true,
      project: { select: { title: true, summary: true } },
    },
  })
}
