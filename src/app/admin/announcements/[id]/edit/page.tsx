import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'

import { getCurrentAdmin, isSiteOwner } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { EditAnnouncementDraftForm } from '@/frontend/components/announcements/AnnouncementForms'

export const metadata = { title: '编辑 ISH 公告 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin('ANNOUNCEMENT_PUBLISH')
  if (!admin) notFound()
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const item = await db.siteAnnouncement.findUnique({ where: { id },
    select: { id: true, title: true, body: true, authorId: true, status: true } })
  if (!item || item.status === 'WITHDRAWN' || (!isSiteOwner(admin.id) && item.authorId !== admin.id)) notFound()
  const backTo = item.status === 'PUBLISHED' ? `/announcements#announcement-${item.id}` : `/admin/announcements#manage-announcement-${item.id}`
  return <><GlobalHeader active="announcements" /><main className="moderation-shell shell-with-header">
    <Link className="page-breadcrumb" href={backTo}>← 返回公告</Link>
    <span className="eyebrow">ISH UPDATES</span><h1>编辑公告</h1>
    <p>{item.status === 'PUBLISHED' ? '修改已发布的公告须说明原因；管理记录会保留前一版本。' : '草稿内容只在管理端可见，发布后才会出现在 ISH 公告页。'}</p>
    <section className="panel governance-panel"><EditAnnouncementDraftForm
      announcementId={item.id} title={item.title} body={item.body} published={item.status === 'PUBLISHED'} />
    </section>
  </main></>
}
