import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { listProjectsForCreator } from '@/backend/projects/queries'
import { ProjectStatusBadge } from '@/frontend/components/projects/ProjectStatusBadge'

export const metadata = { title: 'Dashboard · ISH' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const projects = await listProjectsForCreator(user.id)

  return (
    <div className="dashboard-stack">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">YOUR PROJECTS</span>
          <h1>从一声咩开始</h1>
          <p>把想做的事说清楚。项目会先进入审核，通过后再公开。</p>
        </div>
        <Link className="btn btn-inline" href="/meow/new">
          咩一个项目
        </Link>
      </section>

      <section>
        <div className="section-head">
          <h2>我的项目</h2>
          <Link className="text-link" href="/projects">
            查看公开项目
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state compact-empty">
            <h3>你还没有发出第一声咩</h3>
            <p>项目建立以后，会在这里显示审核和发布状态。</p>
          </div>
        ) : (
          <div className="dashboard-project-list">
            {projects.map((project) => (
              <article className="dashboard-project" key={project.id}>
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
                <Link className="text-link" href={`/projects/${project.id}`}>
                  查看 →
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
