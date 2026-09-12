import type { Prisma } from '@prisma/client'
import { createNotifications } from '@/backend/notifications/write'

/** A publication is announced once to each current favorite; repeated approvals reuse the same source key. */
export async function notifyProjectFavorites(tx: Prisma.TransactionClient, projectId: string, projectTitle: string,
  updateId: string, updateTitle: string, authorId: string) {
  const favorites = await tx.favoriteProject.findMany({ where: { projectId, userId: { not: authorId } },
    select: { userId: true } })
  for (let offset = 0; offset < favorites.length; offset += 400) {
    await createNotifications(tx, favorites.slice(offset, offset + 400).map(item => ({
      recipientUserId: item.userId, sourceKey: `favorite-project-update:${updateId}`,
      type: 'FAVORITE_PROJECT_UPDATE', title: `收藏的项目「${projectTitle}」有新动态`,
      summary: `「${updateTitle}」已公开，点击查看。`,
      href: `/projects/${projectId}/updates?from=notifications&focus=${updateId}#update-${updateId}`,
    })))
  }
}
