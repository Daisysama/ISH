import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentAdmin, isSiteOwner } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { AnnouncementStatusForm, CreateAnnouncementForm, RestoreAnnouncementForm } from '@/frontend/components/announcements/AnnouncementForms'
import { GOVERNANCE_EVENT_LABELS } from '@/shared/governance-labels'

export const metadata = { title: '管理 ISH 公告 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ManageAnnouncementsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const admin = await getCurrentAdmin('ANNOUNCEMENT_PUBLISH')
  if (!admin) notFound()
  const query = await searchParams
  const owner = isSiteOwner(admin.id)
  const deleted = owner && query.view === 'deleted'
  const requestedPage = Number(query.page)
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1
  const where = deleted ? { status: 'WITHDRAWN' as const } : { status: { in: ['DRAFT' as const, 'PUBLISHED' as const] } }
  const [announcements, total, deletedCount] = await Promise.all([
    db.siteAnnouncement.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 30, take: 30,
      include: { author: { select: { displayName: true } }, events: { orderBy: { createdAt: 'desc' } } },
    }),
    db.siteAnnouncement.count({ where }),
    owner ? db.siteAnnouncement.count({ where: { status: 'WITHDRAWN' } }) : Promise.resolve(0),
  ])
  const pageHref = (target: number) => `/admin/announcements?${deleted ? 'view=deleted&' : ''}page=${target}`
  return <><GlobalHeader active="governance" /><main className="moderation-shell shell-with-header">
    <Link className="page-breadcrumb" href="/announcements">← ISH 公告</Link>
    <span className="eyebrow">ISH NEWSROOM</span><h1>管理网站公告</h1>
    <p>先存草稿并核对内容，再发布。公告删除后不会出现在公开页；站主可在这里查看原文、操作记录并恢复。</p>
    {!deleted && <section className="panel governance-panel"><h2>写一则新公告</h2><CreateAnnouncementForm /></section>}
    {owner && <p className="public-user-actions"><Link className="button button-quiet button-compact" href="/admin/announcements">草稿与已发布</Link>
      <Link className="button button-quiet button-compact" href="/admin/announcements?view=deleted">已删除公告（{deletedCount}）</Link></p>}
    <section className="panel governance-panel"><h2>{deleted ? '已删除公告' : '草稿与已发布公告'}</h2>
      {announcements.length === 0 && <p>{deleted ? '目前没有已删除公告。' : '这一页还没有公告。'}</p>}
      {announcements.map(item => <article id={`manage-announcement-${item.id}`} key={item.id} className="governance-rule-item"><strong>{item.title}</strong>
        <p>{item.author.displayName} · {item.status === 'PUBLISHED' ? item.pinnedAt ? '已发布 · 已置顶' : '已发布' : item.status === 'WITHDRAWN' ? '已从公开页删除' : '草稿'} · {item.createdAt.toLocaleString('zh-CN')}</p>
        <p className="update-body">{item.body}</p>
        {(isSiteOwner(admin.id) || item.authorId === admin.id) && item.status !== 'WITHDRAWN' &&
          <p><Link className="button button-quiet button-compact" href={`/admin/announcements/${item.id}/edit`}>编辑公告</Link></p>}
        {(isSiteOwner(admin.id) || item.authorId === admin.id) && item.status === 'DRAFT' &&
          <AnnouncementStatusForm announcementId={item.id} operation="PUBLISH" allowNotifyAll={isSiteOwner(admin.id)} />}
        {isSiteOwner(admin.id) && item.status === 'WITHDRAWN' && item.publishedAt && <RestoreAnnouncementForm announcementId={item.id} />}
        <details><summary>查看操作记录</summary>{item.events.map(event => <p key={event.id}>{event.createdAt.toLocaleString('zh-CN')} · {GOVERNANCE_EVENT_LABELS[event.action] ?? '其他操作'} · 操作用户 ID：{event.actorUserId} · {event.reason}</p>)}</details>
      </article>)}
      <p className="public-user-actions">{page > 1 && <Link className="button button-quiet button-compact" href={pageHref(page - 1)}>上一页</Link>}
        <span>第 {page} 页 · 共 {total} 条</span>
        {page * 30 < total && <Link className="button button-quiet button-compact" href={pageHref(page + 1)}>下一页</Link>}</p>
    </section>
  </main></>
}
