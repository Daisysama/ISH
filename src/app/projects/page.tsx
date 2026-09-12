import Link from 'next/link'

import { getCurrentUser } from '@/backend/auth/current-user'
import { listPublishedProjects } from '@/backend/projects/queries'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { ProjectCard } from '@/frontend/components/projects/ProjectCard'

export const metadata = { title: '羊群广场 · FromISH' }
export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const [projects, user] = await Promise.all([listPublishedProjects(), getCurrentUser()])

  return (
    <>
      <GlobalHeader active="plaza" />
      <main className="site-shell site-shell-with-header">
        <section className="plaza-hero">
          <div>
            <span className="eyebrow">羊群广场 / PROJECT PLAZA</span>
            <h1>加入羊群，一起追逐太阳！</h1>
            <p>
              看看大家最近咩出了什么。这里只展示已经通过审核、正式公开的项目，
              每一张卡片都对应一个真实的人和真实的想法。
            </p>
          </div>
          <div className="plaza-sun" aria-hidden="true"><span /></div>
        </section>

        {projects.length === 0 ? (
          <section className="empty-state empty-state-warm">
            <span className="eyebrow">QUIET MORNING</span>
            <h2>第一声咩还在路上。</h2>
            <p>今天羊群有点安静。要不要成为第一个把想法说出来的人？</p>
            <Link className="button button-primary" href={user ? '/meow/new' : '/register'}>
              {user ? '我先咩一个' : '加入羊群'}
            </Link>
          </section>
        ) : (
          <section className="flock-grid plaza-grid">
            {projects.map((project, index) => (
              <ProjectCard index={index} key={project.id} project={project} />
            ))}
          </section>
        )}

        <footer className="site-footer compact-footer">
          <div><strong>FromISH</strong><span>by ISH 伊始</span></div>
          <Link href="/">回到首页</Link>
        </footer>
      </main>
    </>
  )
}
