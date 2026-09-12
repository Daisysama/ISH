import Link from 'next/link'

import { readSession } from '@/backend/auth/session'
import { listPublishedProjects } from '@/backend/projects/queries'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { ProjectCard } from '@/frontend/components/projects/ProjectCard'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [userId, projects] = await Promise.all([readSession(), listPublishedProjects({ sort: 'newest' })])
  const featured = projects.slice(0, 3)

  return (
    <>
      <GlobalHeader />
      <main className="site-shell site-shell-with-header">
        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="eyebrow">FROM IDEAS TO WHAT&apos;S NEXT</span>
            <h1>
              有点子？上伊始！
              <br />
              找乐子？也上伊始！
            </h1>
            <p>
              创作者在这里把想法咩出来，玩家在这里提前遇见还没长大的作品。
              一声小小的咩，也许就是某个更大明天的伊始。
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href={userId ? '/meow/new' : '/register'}>
                {userId ? '咩一个想法' : '加入羊群'} <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-quiet" href="/projects">
                先去逛逛
              </Link>
            </div>
          </div>

          <div className="home-hero-art" aria-hidden="true">
            <div className="hero-sun" />
            <div className="hero-hill hero-hill-back" />
            <div className="hero-hill hero-hill-front" />
            <p className="hero-handwriting">A small light.<br />A larger tomorrow.</p>
          </div>
        </section>

        <section className="path-grid" aria-label="FromISH 可以做什么">
          <Link className="path-card" href={userId ? '/meow/new' : '/register'}>
            <span className="path-index">01</span>
            <div>
              <strong>把点子咩出来</strong>
              <p>先说清楚想做什么，剩下的咩可以慢慢长。</p>
            </div>
            <span className="path-arrow" aria-hidden="true">↗</span>
          </Link>
          <Link className="path-card" href="/projects">
            <span className="path-index">02</span>
            <div>
              <strong>去羊群里逛逛</strong>
              <p>也许有人正在做你一直想玩的那个东西。</p>
            </div>
            <span className="path-arrow" aria-hidden="true">↗</span>
          </Link>
          <Link className="path-card" href="/projects">
            <span className="path-index">03</span>
            <div>
              <strong>晒太阳</strong>
              <p>审核通过后，项目就会来到羊群广场。</p>
            </div>
            <span className="path-arrow" aria-hidden="true">↗</span>
          </Link>
        </section>

        <aside className="platform-notice platform-notice-home">
          <strong>关于这里</strong>
          <p>FromISH 是兴趣创作与共创交流平台。用户发布的项目、观点及外部链接不代表 ISH 立场；平台当前不提供招聘、猎头、投资撮合或融资服务。</p>
        </aside>

        <section className="home-flock-section">
          <div className="section-title-row">
            <div>
              <span className="eyebrow">羊群广场</span>
              <h2>看看最近是谁先咩了一声。</h2>
            </div>
            <Link className="story-link" href="/projects">
              进入羊群广场 <span aria-hidden="true">→</span>
            </Link>
          </div>

          {featured.length > 0 ? (
            <div className="flock-grid flock-grid-home">
              {featured.map((project, index) => (
                <ProjectCard index={index} key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="home-empty">
              <div className="home-empty-orbit" aria-hidden="true" />
              <div>
                <strong>第一声咩还在路上。</strong>
                <p>这里不会用假项目填满门面。第一只真正公开的项目，会从这里开始。</p>
              </div>
              <Link className="button button-primary button-compact" href={userId ? '/meow/new' : '/register'}>
                我先咩一个
              </Link>
            </div>
          )}
        </section>

        <footer className="site-footer">
          <div>
            <strong>FromISH</strong>
            <span>by ISH 伊始</span>
          </div>
          <p>有点子，找同伴；好玩意，在路上。</p>
        </footer>
      </main>
    </>
  )
}
