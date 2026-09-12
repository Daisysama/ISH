import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { listNotifications } from '@/backend/notifications/queries'
import { markAllNotificationsReadAction, openNotificationAction } from '@/backend/notifications/actions'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'

export const metadata = { title: '消息提醒 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const notices = await listNotifications(user.id)
  const unread = notices.filter(item => !item.readAt).length
  return (
    <>
      <GlobalHeader active="notifications" />
      <main className="moderation-shell shell-with-header notice-inbox">
        <div className="section-title-row">
          <div><span className="eyebrow">YOUR NOTICES</span><h1>消息提醒</h1><p>同行关系和申诉的变化，会在这里留下可回看的提醒。</p></div>
          {unread > 0 && <form action={markAllNotificationsReadAction}><button className="button button-quiet button-compact" type="submit">全部标为已读</button></form>}
        </div>
        {notices.length === 0 && <section className="empty-state compact-empty"><h2>目前没有新消息。</h2></section>}
        <div className="notice-inbox-list">
          {notices.map(item => (
            <form action={openNotificationAction} key={item.id} className={`notice-inbox-item ${item.readAt ? '' : 'is-unread'}`}>
              <input type="hidden" name="notificationId" value={item.id} />
              <button type="submit" className="notice-inbox-open">
                <span><strong>{item.title}</strong>{!item.readAt && <span className="review-new-result">未读</span>}</span>
                {item.summary && <span>{item.summary}</span>}
                <time dateTime={item.createdAt.toISOString()}>{item.createdAt.toLocaleString('zh-CN')}</time>
              </button>
            </form>
          ))}
        </div>
      </main>
    </>
  )
}
