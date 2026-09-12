import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { listProjectsForCreator } from '@/backend/projects/queries'
import { ProjectStatusBadge } from '@/frontend/components/projects/ProjectStatusBadge'

export const metadata = { title: '我的羊群 · FromISH' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const projects = await listProjectsForCreator(user.id)

  return (
    <div className="dashboard-stack">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">YOUR TRAIL</span>
          <h1>{user.displayName}，今天想咩点什么？</h1>
          <p>这里记录你发出的每一声咩。审核状态、公开结果和退回原因都会留在原地。</p>
        </div>
        <Link className="button button-primary" href="/meow/new">
          咩一个想法 <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section>
        <div className="section-title-row dashboard-section-title">
          <div>
            <span className="eyebrow">我的项目</span>
            <h2>每一声咩，都有它自己的路。</h2>
          </div>
          <Link className="story-link" href="/projects">
            去羊群广场 <span aria-hidden="true">→</span>
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state compact-empty empty-state-warm">
            <h3>你的第一声咩还没发出来。</h3>
            <p>不用写商业计划书。先把想做什么说清楚，就已经是一个开始。</p>
            <Link className="button button-primary button-compact" href="/meow/new">
              去咩一个
            </Link>
          </div>
        ) : (
          <div className="dashboard-project-list">
            {projects.map((project, index) => (
              <article className="dashboard-project" key={project.id}>
                <div className={`dashboard-project-orb dashboard-project-orb-${index % 3}`} aria-hidden="true" />
                <div className="dashboard-project-main">
                  <div className="dashboard-project-title-row">
                    <h3>
                      <Link href={`/projects/${project.id}`}>{project.title}</Link>
                    </h3>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <p>{project.summary}</p>
                  {project.status === 'REJECTED' && project.rejectionReason && (
                    <p className="rejection-preview">
                      <strong>退回原因：</strong> {project.rejectionReason}
                    </p>
                  )}
                </div>
                <Link className="story-link" href={`/projects/${project.id}`}>
                  查看 <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
