import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { listFavoriteProjectsForUser, listHiddenProjectsForUser } from '@/backend/profile/preference-queries'
import { getUserProfile } from '@/backend/profile/queries'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { FavoriteProjectsPanel } from '@/frontend/components/profile/FavoriteProjectsPanel'
import { HiddenProjectsPanel } from '@/frontend/components/profile/HiddenProjectsPanel'
import { ProfileForm } from '@/frontend/components/profile/ProfileForm'

export const metadata: Metadata = {
  title: '我的画像 · FromISH',
  robots: { index: false, follow: false },
}

export default async function ProfilePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [profile, favoriteProjects, hiddenProjects] = await Promise.all([
    getUserProfile(user.id),
    listFavoriteProjectsForUser(user.id),
    listHiddenProjectsForUser(user.id),
  ])
  if (!profile) redirect('/login')

  return (
    <>
      <GlobalHeader />
      <main className="profile-shell shell-with-header">
        <section className="profile-heading">
          <span className="eyebrow">YOUR SIGNAL</span>
          <h1>想让羊群更懂您一点吗？</h1>
          <p>不用填也能正常使用。花一分钟选几项，我们就能少给您看一点不感兴趣的东西。</p>
        </section>
        <section className="panel profile-panel">
          <ProfileForm profile={profile} />
        </section>
        <section className="panel profile-account-id">
          <h2>账号 UID</h2>
          <p>这是您的稳定短编号；其他用户可用它找到您的公开资料。</p>
          <code>{profile.uid}</code>
          <details><summary>站主首次配置所需的内部编号</summary><p>现有站主环境变量仍使用内部 UUID，不能直接填 UID。</p><code>{user.id}</code></details>
        </section>
        <p><Link className="story-link" href="/profile/blocks">管理我的拉黑名单 →</Link></p>
        <FavoriteProjectsPanel projects={favoriteProjects} />
        <HiddenProjectsPanel projects={hiddenProjects} />
      </main>
    </>
  )
}
