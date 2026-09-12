import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/backend/auth/current-user'
import { getPublicUserResume } from '@/backend/profile/public-queries'
import { resolveUserId } from '@/backend/profile/resolve-user'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { UserBlockForm } from '@/frontend/components/blocks/UserBlockForm'
import { safePublicProfileReturn } from '@/shared/user-navigation'

export const metadata = { title: '同行者资料 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function PublicUserPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string | string[] }>
}) {
  const { id } = await params
  const userId = await resolveUserId(id)
  if (!userId) notFound()
  const viewer = await getCurrentUser()
  const profile = await getPublicUserResume(userId, viewer?.id)
  if (!profile) notFound()
  const returnTo = safePublicProfileReturn((await searchParams).returnTo)
  return <><GlobalHeader /><main className="profile-shell shell-with-header public-user-page">
    <Link className="page-breadcrumb" href={returnTo}>← 返回之前的页面</Link>
    <section className="panel profile-panel">
      <span className="eyebrow">FROMISH PROFILE</span><h1>{profile.displayName}</h1>
      <p>加入于 {profile.createdAt.toLocaleDateString('zh-CN')} · UID：<code>{profile.uid}</code></p>
      {!profile.publicProfileEnabled && <p className="hint">这位用户尚未选择公开个人介绍与同行履历。</p>}
      {profile.publicProfileEnabled && profile.profileBio && <p className="update-body">{profile.profileBio}</p>}
      {profile.publicProfileEnabled && profile.skillTags.length > 0 && <p>技能与方向：{profile.skillTags.join(' · ')}</p>}
      {profile.publicProfileEnabled && profile.experienceText && <div><h2>自己填写的经历</h2><p className="update-body">{profile.experienceText}</p></div>}
      {profile.publicProfileEnabled && profile.portfolioUrl && <p><a className="story-link" href={profile.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow">查看作品链接 ↗</a></p>}
      {viewer && viewer.id !== userId && <div className="public-user-actions">
        <UserBlockForm targetUserId={userId} active={profile.blocked} />
        <Link className="button button-quiet button-compact" href={`/users/${profile.uid}/report?${new URLSearchParams({ returnTo })}`}>举报此用户</Link>
      </div>}
    </section>
    <section className="panel profile-panel"><h2>发起的公开项目</h2>
      {profile.createdProjects.length ? profile.createdProjects.map(project =>
        <p key={project.id}><Link className="story-link" href={`/projects/${project.id}?from=projects`}>{project.title}</Link> · {project.summary}</p>) : <p>暂无公开项目。</p>}
    </section>
    <section className="panel profile-panel"><h2>正在同行的公开项目</h2>
      {profile.publicProfileEnabled && profile.projectMemberships.length ? profile.projectMemberships.map(item =>
        <p key={item.project.id}><Link className="story-link" href={`/projects/${item.project.id}?from=projects`}>{item.project.title}</Link>
          {item.roles.length ? ` · ${item.roles.join(' / ')}` : ''}</p>) : <p>{profile.publicProfileEnabled ? '暂无公开同行项目。' : '本人尚未选择公开当前同行履历。'}</p>}
      <p className="hint">仅展示当前仍在同行的公开项目；测试游戏等经历可由本人在上方经历中自愿填写，平台尚未核验。</p>
    </section>
  </main></>
}
