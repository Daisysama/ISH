import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getCurrentAdmin } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { ModerationPanel } from '@/frontend/components/moderation/ModerationPanel'

export const metadata = { title: '项目审核 · ISH' }
export const dynamic = 'force-dynamic'

export default async function ModerationPage() {
  const admin = await getCurrentAdmin()
  if (!admin) notFound()

  const projects = await db.project.findMany({
    where: { status: 'PENDING' },
    orderBy: { submittedAt: 'asc' },
    include: {
      creator: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
  })

  return (
    <main className="standalone-shell moderation-shell">
      <div className="page-head">
        <div>
          <span className="eyebrow">MODERATION</span>
          <h1>待审核的咩</h1>
          <p>当前采用人工先审后发。通过即公开；退回必须给出明确理由。</p>
        </div>
        <Link className="text-link" href="/dashboard">
          返回工作台
        </Link>
      </div>

      {projects.length === 0 ? (
        <section className="empty-state">
          <h2>审核队列为空</h2>
          <p>目前没有等待处理的项目。</p>
        </section>
      ) : (
        <section className="moderation-list">
          {projects.map((project) => (
            <article className="moderation-card" key={project.id}>
              <div className="project-card-meta">
                <span>{project.creator.displayName}</span>
                <span>{project.creator.email}</span>
                <time dateTime={project.submittedAt.toISOString()}>
                  {project.submittedAt.toLocaleString('zh-CN')}
                </time>
              </div>
              <h2>{project.title}</h2>
              <p className="project-lead">{project.summary}</p>
              <div className="prose-text moderation-description">{project.description}</div>
              <p>
                <Link className="text-link" href={`/projects/${project.id}`}>
                  打开非公开项目页 →
                </Link>
              </p>
              <ModerationPanel projectId={project.id} />
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
