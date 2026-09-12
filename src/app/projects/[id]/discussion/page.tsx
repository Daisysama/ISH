import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/backend/auth/current-user'
import { getDiscussion } from '@/backend/comments/queries'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { CommentThread } from '@/frontend/components/comments/CommentThread'

export const metadata = { title: '公开讨论 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ProjectDiscussionPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ update?: string; page?: string; from?: string; comment?: string }>
}) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const query = await searchParams
  const updateId = query.update ? z.string().uuid().safeParse(query.update) : null
  if (updateId && !updateId.success) notFound()
  const page = Math.min(1000, Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1))
  const user = await getCurrentUser()
  const writingRestriction = user ? await db.userSanction.findFirst({ where: {
    targetId: user.id, status: 'ACTIVE', scope: { in: ['COMMENTS', 'POSTING', 'ACCOUNT', 'SITE'] },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  }, select: { id: true } }) : null
  const discussion = await getDiscussion(id, updateId?.success ? updateId.data : null, user?.id, page)
  if (!discussion) notFound()
  const targetId = z.string().uuid().safeParse(query.comment)
  if (targetId.success) {
    const item = await db.projectComment.findUnique({ where: { id: targetId.data }, select: {
      id: true, projectId: true, updateId: true, parentId: true, status: true,
      parent: { select: { id: true, createdAt: true, status: true, authorId: true } },
      createdAt: true, authorId: true,
    } })
    if (item && item.projectId === id && item.updateId === (updateId?.success ? updateId.data : null) &&
      (item.status !== 'PENDING' || item.authorId === user?.id)) {
      const root = item.parentId ? item.parent : item
      if (root && (root.status !== 'PENDING' || root.authorId === user?.id)) {
        const visible: Prisma.ProjectCommentWhereInput = { OR: [{ status: { in: ['VISIBLE', 'DELETED', 'HIDDEN'] } },
          ...(user ? [{ status: 'PENDING' as const, authorId: user.id }] : [])] }
        const before = await db.projectComment.count({ where: { projectId: id, updateId: updateId?.success ? updateId.data : null,
          parentId: null, AND: [visible, { OR: [
            { createdAt: { gt: root.createdAt } },
            { createdAt: root.createdAt, id: { gt: root.id } },
          ] }],
        } })
        const targetPage = Math.floor(before / 30) + 1
        if (targetPage !== page) {
          const params = new URLSearchParams({ comment: item.id, page: String(targetPage) })
          if (updateId?.success) params.set('update', updateId.data)
          if (query.from === 'notifications') params.set('from', 'notifications')
          redirect(`/projects/${id}/discussion?${params}#comment-${item.id}`)
        }
      }
    }
  }
  const fromUpdates = Boolean(updateId?.success)
  const back = query.from === 'notifications' ? '/notifications' : fromUpdates ? `/projects/${id}/updates?from=detail` : `/projects/${id}?from=${query.from === 'dashboard' ? 'dashboard' : 'projects'}`
  const root = `/projects/${id}/discussion${updateId?.success ? `?update=${updateId.data}` : '?'}`
  return <><GlobalHeader /><main className="team-page-shell shell-with-header comment-page">
    <Link className="page-breadcrumb" href={back}>← {query.from === 'notifications' ? '消息提醒' : fromUpdates ? '项目动态' : '项目详情'}</Link>
    <span className="eyebrow">PUBLIC CONVERSATION</span>
    <h1>{discussion.updateTitle ? `动态「${discussion.updateTitle}」的讨论` : `项目「${discussion.title}」的讨论`}</h1>
    <CommentThread discussion={discussion} projectId={id} updateId={updateId?.success ? updateId.data : null}
      viewerId={user?.id} canComment={Boolean(user && !writingRestriction)} fromNotifications={query.from === 'notifications'} />
    <nav className="comment-pagination" aria-label="评论分页">
      {page > 1 && <Link className="button button-quiet button-compact" href={`${root}${root.endsWith('?') ? '' : '&'}page=${page - 1}`}>← 上一页</Link>}
      <span>第 {page} 页</span>
      {discussion.hasNext && <Link className="button button-quiet button-compact" href={`${root}${root.endsWith('?') ? '' : '&'}page=${page + 1}`}>下一页 →</Link>}
    </nav>
  </main></>
}
