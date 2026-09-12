'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'

export async function openNotificationAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const id = z.string().uuid().safeParse(formData.get('notificationId'))
  if (!id.success) redirect('/notifications')
  const notice = await db.userNotification.findFirst({
    where: { id: id.data, recipientUserId: user.id }, select: { href: true },
  })
  if (!notice) redirect('/notifications')
  await db.userNotification.updateMany({
    where: { id: id.data, recipientUserId: user.id, readAt: null }, data: { readAt: new Date() },
  })
  revalidatePath('/notifications')
  // 数据库只由服务端生成内部路径；仍阻止错误数据形成站外跳转。
  if (!notice.href.startsWith('/') || notice.href.startsWith('//')) redirect('/notifications')
  const destination = new URL(notice.href, 'http://localhost')
  if (destination.pathname.startsWith('/projects/') && !destination.searchParams.has('from')) {
    destination.searchParams.set('from', 'notifications')
  }
  redirect(`${destination.pathname}${destination.search}${destination.hash}`)
}

export async function markAllNotificationsReadAction() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  await db.userNotification.updateMany({
    where: { recipientUserId: user.id, readAt: null }, data: { readAt: new Date() },
  })
  revalidatePath('/notifications')
}
