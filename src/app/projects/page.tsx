import Link from 'next/link'

import { readSession } from '@/backend/auth/session'
import { listPublishedProjects } from '@/backend/projects/queries'

export const metadata = { title: '公开项目 · ISH' }
export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const [projects, userId] = await Promise.all([
    listPublishedProjects(),
    readSession(),
  ])

  return (
    <main className="standalone-shell">
      <div className="public-nav">
        <Link className="brand brand-link" href="/projects">
          <div className="brandmark">ISH</div>
          <div>
            <p className="brand-name">伊始</p>
            <span className="brand-tagline">没有牧羊人，只有同行者。</span>
          </div>
        </Link>
        <div className="public-nav-actions">
          {userId ? (
            <>
              <Link className="btn btn-ghost" href="/dashboard">
                工作台
              </Link>
              <Link className="btn btn-inline" href="/meow/new">
                咩一个项目
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost" href="/login">
                登录
              </Link>
              <Link className="btn btn-inline" href="/register">
                注册
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="page-head page-head-spaced">
        <div>
          <span className="eyebrow">PUBLIC PROJECTS</span>
          <h1>正在发生的项目</h1>
          <p>这里只展示已经通过审核、正式公开的“咩”。</p>
        </div>
      </div>

      {projects.length === 0 ? (
        <section className="empty-state">
          <h2>第一声咩还在路上</h2>
          <p>公开项目会出现在这里。你也可以成为第一个把想法说出来的人。</p>
          <Link className="btn btn-inline" href={userId ? '/meow/new' : '/register'}>
            {userId ? '咩一个项目' : '注册并参与'}
          </Link>
        </section>
      ) : (
        <section className="project-grid">
          {projects.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-card-meta">
                <span>{project.creator.displayName}</span>
                {project.publishedAt && (
                  <time dateTime={project.publishedAt.toISOString()}>
                    {project.publishedAt.toLocaleDateString('zh-CN')}
                  </time>
                )}
              </div>
              <h2>
                <Link href={`/projects/${project.id}`}>{project.title}</Link>
              </h2>
              <p>{project.summary}</p>
              <Link className="text-link" href={`/projects/${project.id}`}>
                查看项目 →
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
