import { db } from '@/backend/database/client'

export function countUnreadNotifications(userId: string) {
  return db.userNotification.count({ where: { recipientUserId: userId, readAt: null } })
}

export function listNotifications(userId: string) {
  return db.userNotification.findMany({
    where: { recipientUserId: userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, type: true, title: true, summary: true, href: true, createdAt: true, readAt: true },
  })
}
