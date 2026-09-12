import type { Metadata } from 'next'
import Link from 'next/link'

import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { getPreferenceLearningContext } from '@/backend/profile/preference-queries'
import { getUserProfile } from '@/backend/profile/queries'
import { listPublishedProjects } from '@/backend/projects/queries'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { DiscoveryFilter } from '@/frontend/components/projects/DiscoveryFilter'
import { ProjectCard } from '@/frontend/components/projects/ProjectCard'

export const metadata: Metadata = {
  title: '羊群广场 · FromISH',
  description: '发现正在成长的创作项目、Demo、试玩邀请与共创机会。',
  alternates: { canonical: '/projects' },
}
export const dynamic = 'force-dynamic'

type SearchParamValue = string | string[] | undefined
type SearchParams = Promise<{ stage?: SearchParamValue; purpose?: SearchParamValue; type?: SearchParamValue; sort?: SearchParamValue; direction?: SearchParamValue }>

function asList(value: SearchParamValue) {
  if (!value) return []
  return (Array.isArray(value) ? value : [value]).filter(Boolean)
}

function asSingle(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const user = await getCurrentUser()
  const profile = user ? await getUserProfile(user.id) : null
  const preferenceContext = user ? await getPreferenceLearningContext(user.id) : null
  const blockedUsers = user ? await db.userBlock.findMany({ where: { blockerId: user.id, active: true }, select: { blockedId: true } }) : []
  const hasProfile = Boolean(profile && (profile.likeTags.length || profile.skillTags.length || profile.dislikeTags.length))
  const hasRecommendationProfile = Boolean(hasProfile || preferenceContext?.tagSignals.length)
  const stages = asList(params.stage)
  const purposes = asList(params.purpose)
  const types = asList(params.type)
  const sortParam = asSingle(params.sort)
  const directionParam = asSingle(params.direction)
  const requestedSort = sortParam === 'recommended' || sortParam === 'published' || sortParam === 'interested' || sortParam === 'favorites' ? sortParam : undefined
  const effectiveSort = requestedSort === 'recommended' && !hasRecommendationProfile
    ? 'published'
    : requestedSort ?? (hasRecommendationProfile ? 'recommended' : 'published')
  const direction = directionParam === 'asc' ? 'asc' : 'desc'
  const projects = await listPublishedProjects(
    {
      stages,
      purposes,
      typeTags: types,
      sort: effectiveSort,
      direction,
    },
    hasRecommendationProfile && profile ? { skillTags: profile.skillTags, likeTags: profile.likeTags, dislikeTags: profile.dislikeTags, inferredTags: preferenceContext?.tagSignals ?? [] } : null,
    preferenceContext?.hiddenProjectIds ?? [],
    blockedUsers.map(item => item.blockedId),
  )

  return (
    <>
      <GlobalHeader active="plaza" />
      <main className="site-shell site-shell-with-header">
        <section className="plaza-hero">
          <div><span className="eyebrow">羊群广场 / PROJECT PLAZA</span><h1>加入羊群，一起追逐太阳！</h1><p>想看点子、Demo、试玩邀请，还是找羊同行？按您喜欢的方式逛！</p></div>
          <div className="plaza-sun" aria-hidden="true"><span /></div>
        </section>

        {user && !hasProfile && (
          <aside className="profile-nudge"><div><strong>想让羊群更懂您一点吗？</strong><p>花一分钟选喜欢、雷点和技能，推荐会更贴近您。</p></div><Link className="button button-quiet button-compact" href="/profile">完善兴趣画像</Link></aside>
        )}

        <DiscoveryFilter
          selectedPurposes={purposes}
          selectedStages={stages}
          selectedTypes={types}
          showRecommended={hasRecommendationProfile}
          sort={effectiveSort}
          direction={direction}
        />

        {projects.length === 0 ? <section className="empty-state empty-state-warm"><h2>这一片暂时没有咩。</h2><p>换个筛选条件，或者自己先咩一声。</p><Link className="button button-primary" href={user ? '/meow/new' : '/register'}>{user ? '我先咩一个' : '加入羊群'}</Link></section> : <section className="flock-grid plaza-grid">{projects.map((project,index)=><ProjectCard index={index} key={project.id} project={project} preferenceContext={preferenceContext ? { likedTags: preferenceContext.likeTags, dislikedTags: preferenceContext.dislikeTags, suppressInterestedPrompt: preferenceContext.suppressInterestedPrompt, suppressNotInterestedPrompt: preferenceContext.suppressNotInterestedPrompt, initialKind: preferenceContext.projectPreferences.find(item => item.projectId === project.id)?.kind ?? null, initialHidden: preferenceContext.hiddenProjectIds.includes(project.id), initialFavorited: preferenceContext.favoriteProjectIds.includes(project.id) } : null} />)}</section>}

        <aside className="platform-notice"><strong>平台说明</strong><p>FromISH 是兴趣创作与共创交流平台。用户发布的项目、观点及外部链接不代表 ISH 立场；平台当前不提供招聘、猎头、投资撮合或融资服务。</p></aside>
        <footer className="site-footer compact-footer"><div><strong>FromISH</strong><span>by ISH 伊始</span></div><Link href="/">回到首页</Link></footer>
      </main>
    </>
  )
}
