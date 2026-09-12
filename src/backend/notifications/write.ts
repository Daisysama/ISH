import type { Prisma } from '@prisma/client'

/** 在原业务事务内写提醒；同一接收人及来源只出现一次。 */
export async function createNotifications(
  tx: Prisma.TransactionClient,
  notifications: Prisma.UserNotificationCreateManyInput[],
) {
  if (notifications.length === 0) return
  await tx.userNotification.createMany({ data: notifications, skipDuplicates: true })
}
