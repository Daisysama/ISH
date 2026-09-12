import { db } from '@/backend/database/client'
import { getCurrentUser } from '@/backend/auth/current-user'
import { hasSitePermission, isSiteOwner } from '@/backend/auth/admin'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import Link from 'next/link'
import { DeleteAnnouncementForm, PinAnnouncementForm } from '@/frontend/components/announcements/AnnouncementForms'

export const metadata = { title: 'ISH 公告 · FromISH' }
export const dynamic = 'force-dynamic'

export default async function AnnouncementsPage() {
  const viewer = await getCurrentUser()
  const canEdit = viewer ? await hasSitePermission(viewer.id, 'ANNOUNCEMENT_PUBLISH') : false
  const items = await db.siteAnnouncement.findMany({ where: { status: 'PUBLISHED' },
    orderBy: [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { publishedAt: 'desc' }, { id: 'desc' }], take: 50,
    select: { id: true, authorId: true, title: true, body: true, publishedAt: true,
      pinnedAt: true, events: { where: { action: 'EDITED_PUBLISHED' }, orderBy: { createdAt: 'desc' }, take: 1,
        select: { createdAt: true } },
    } })
  return <><GlobalHeader active="announcements" /><main className="moderation-shell shell-with-header">
    <span className="eyebrow">ISH UPDATES</span><h1>ISH 公告</h1><p>网站规则、功能和重要事项的正式说明会留在这里。</p>
    {canEdit && <p><Link className="button button-quiet button-compact" href="/admin/announcements">起草并发布公告</Link></p>}
    {items.length === 0 && <section className="empty-state compact-empty"><h2>目前还没有公告。</h2></section>}
    <div className="moderation-list">{items.map(item => {
      const mayManage = Boolean(canEdit && viewer && (isSiteOwner(viewer.id) || item.authorId === viewer.id))
      return <div key={item.id} className={`announcement-entry${mayManage ? '' : ' announcement-entry--read-only'}`}>
      <article id={`announcement-${item.id}`} className="panel governance-panel">
      <div className="announcement-meta"><time dateTime={item.publishedAt?.toISOString()}>{item.publishedAt?.toLocaleString('zh-CN')}</time>
        {item.pinnedAt && <span className="history-status">置顶</span>}</div><h2>{item.title}</h2>
      <p className="update-body">{item.body}</p>
      {item.events[0] && <small>最后修订：{item.events[0].createdAt.toLocaleString('zh-CN')}</small>}
      </article>
      {mayManage &&
        <aside className="announcement-controls" aria-label={`管理公告「${item.title}」`}>
          <Link className="button button-quiet button-compact" href={`/admin/announcements/${item.id}/edit`}>编辑</Link>
          <DeleteAnnouncementForm announcementId={item.id} />
          <PinAnnouncementForm announcementId={item.id} pinned={Boolean(item.pinnedAt)} />
        </aside>}
    </div>})}</div>
  </main></>
}
