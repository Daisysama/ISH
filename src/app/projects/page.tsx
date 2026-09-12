import type { Metadata } from 'next'
import Link from 'next/link'

import { getCurrentUser } from '@/backend/auth/current-user'
import { getUserProfile } from '@/backend/profile/queries'
import { listPublishedProjects } from '@/backend/projects/queries'
import { PROJECT_TYPE_OPTIONS } from '@/core/meow/project'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { ProjectCard } from '@/frontend/components/projects/ProjectCard'
import { PROJECT_PURPOSE_LABELS, PROJECT_STAGE_LABELS } from '@/shared/project'

export const metadata: Metadata = {
  title: '羊群广场 · FromISH',
  description: '发现正在成长的创作项目、Demo、试玩邀请与共创机会。',
  alternates: { canonical: '/projects' },
}
export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ stage?: string; purpose?: string; type?: string; sort?: string }>

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const user = await getCurrentUser()
  const profile = user ? await getUserProfile(user.id) : null
  const hasProfile = Boolean(profile && (profile.likeTags.length || profile.skillTags.length || profile.dislikeTags.length))
  const projects = await listPublishedProjects(
    {
      stage: params.stage,
      purpose: params.purpose,
      typeTag: params.type,
      sort: params.sort === 'oldest' || params.sort === 'newest' || params.sort === 'recommended' ? params.sort : undefined,
    },
    hasProfile && profile ? { skillTags: profile.skillTags, likeTags: profile.likeTags, dislikeTags: profile.dislikeTags } : null,
  )

  return (
    <>
      <GlobalHeader active="plaza" />
      <main className="site-shell site-shell-with-header">
        <section className="plaza-hero">
          <div><span className="eyebrow">羊群广场 / PROJECT PLAZA</span><h1>加入羊群，一起追逐太阳！</h1><p>想看点子、Demo、试玩邀请，还是找同行？按你自己的方式逛。</p></div>
          <div className="plaza-sun" aria-hidden="true"><span /></div>
        </section>

        {user && !hasProfile && (
          <aside className="profile-nudge"><div><strong>想让羊群更懂你一点吗？</strong><p>花一分钟选喜欢、雷点和技能，推荐会更贴近你。</p></div><Link className="button button-quiet button-compact" href="/profile">完善兴趣画像</Link></aside>
        )}

        <form className="discovery-filter" method="get">
          <select name="stage" defaultValue={params.stage ?? ''}><option value="">全部阶段</option>{Object.entries(PROJECT_STAGE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select name="purpose" defaultValue={params.purpose ?? ''}><option value="">全部目的</option>{Object.entries(PROJECT_PURPOSE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select name="type" defaultValue={params.type ?? ''}><option value="">全部类型</option>{PROJECT_TYPE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}</select>
          <select name="sort" defaultValue={params.sort ?? (hasProfile ? 'recommended' : 'newest')}><option value="recommended">为你推荐</option><option value="newest">最新发布</option><option value="oldest">最早发布</option></select>
          <button className="button button-primary button-compact" type="submit">筛一筛</button>
          <Link className="story-link" href="/projects">清空</Link>
        </form>

        {projects.length === 0 ? <section className="empty-state empty-state-warm"><h2>这一片暂时没有咩。</h2><p>换个筛选条件，或者自己先咩一声。</p><Link className="button button-primary" href={user ? '/meow/new' : '/register'}>{user ? '我先咩一个' : '加入羊群'}</Link></section> : <section className="flock-grid plaza-grid">{projects.map((project,index)=><ProjectCard index={index} key={project.id} project={project} />)}</section>}

        <aside className="platform-notice"><strong>平台说明</strong><p>FromISH 是兴趣创作与共创交流平台。用户发布的项目、观点及外部链接不代表 ISH 立场；平台当前不提供招聘、猎头、投资撮合或融资服务。</p></aside>
        <footer className="site-footer compact-footer"><div><strong>FromISH</strong><span>by ISH 伊始</span></div><Link href="/">回到首页</Link></footer>
      </main>
    </>
  )
}
