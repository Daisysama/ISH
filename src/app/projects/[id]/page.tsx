import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { isAdminEmail } from '@/backend/auth/admin'
import { getProjectById } from '@/backend/projects/queries'
import { ProjectStatusBadge } from '@/frontend/components/projects/ProjectStatusBadge'

export const dynamic = 'force-dynamic'

type ProjectPageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { id } = await params
  const project = await getProjectById(id)

  if (!project || project.status !== 'PUBLISHED') {
    return { title: '项目 · ISH' }
  }

  return {
    title: `${project.title} · ISH`,
    description: project.summary,
  }
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) notFound()

  const user = await getCurrentUser()
  const viewerIsCreator = user?.id === project.creatorId
  const viewerIsAdmin = user ? isAdminEmail(user.email) : false

  if (project.status !== 'PUBLISHED') {
    // 待审核 / 未通过项目不能通过猜 UUID 被其他登录用户看到。
    if (!viewerIsCreator && !viewerIsAdmin) notFound()
  }

  const isPrivatePreview = project.status !== 'PUBLISHED'

  return (
    <main className="standalone-shell project-detail-shell">
      <div className="project-detail-topbar">
        <Link className="text-link" href={isPrivatePreview ? '/dashboard' : '/projects'}>
          ← {isPrivatePreview ? '返回工作台' : '返回公开项目'}
        </Link>
        {isPrivatePreview && <ProjectStatusBadge status={project.status} />}
      </div>

      {isPrivatePreview && (
        <div className="notice notice-private">
          <strong>这是非公开预览。</strong>
          {project.status === 'PENDING'
            ? ' 项目正在等待审核，其他普通用户无法访问这个页面。'
            : ' 项目没有通过本轮审核，其他普通用户无法访问这个页面。'}
        </div>
      )}

      {project.status === 'REJECTED' && project.rejectionReason && (
        <div className="notice notice-danger">
          <strong>退回原因：</strong> {project.rejectionReason}
        </div>
      )}

      <article className="project-detail">
        <header>
          <div className="project-card-meta">
            <span>由 {project.creator.displayName} 发起</span>
            <span>
              {project.publishedAt
                ? `发布于 ${project.publishedAt.toLocaleDateString('zh-CN')}`
                : `提交于 ${project.submittedAt.toLocaleDateString('zh-CN')}`}
            </span>
          </div>
          <h1>{project.title}</h1>
          <p className="project-lead">{project.summary}</p>
        </header>

        <section className="project-description">
          <h2>项目说明</h2>
          <div className="prose-text">{project.description}</div>
        </section>
      </article>

      {(viewerIsCreator || viewerIsAdmin) && project.moderationEvents.length > 0 && (
        <section className="panel audit-panel">
          <h2>审核记录</h2>
          <p className="muted">审核操作保留记录，便于后续追溯。</p>
          <div className="audit-list">
            {project.moderationEvents.map((event) => (
              <div className="audit-item" key={event.id}>
                <strong>{event.action === 'APPROVED' ? '审核通过' : '退回修改'}</strong>
                <time dateTime={event.createdAt.toISOString()}>
                  {event.createdAt.toLocaleString('zh-CN')}
                </time>
                {event.note && <p>{event.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
