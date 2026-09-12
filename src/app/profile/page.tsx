import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { getUserProfile } from '@/backend/profile/queries'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { ProfileForm } from '@/frontend/components/profile/ProfileForm'

export const metadata: Metadata = {
  title: '我的画像 · FromISH',
  robots: { index: false, follow: false },
}

export default async function ProfilePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getUserProfile(user.id)
  if (!profile) redirect('/login')

  return (
    <>
      <GlobalHeader />
      <main className="profile-shell shell-with-header">
        <section className="profile-heading">
          <span className="eyebrow">YOUR SIGNAL</span>
          <h1>想让羊群更懂你一点吗？</h1>
          <p>不用填也能正常使用。花一分钟选几项，我们就能少给你看一点不感兴趣的东西。</p>
        </section>
        <section className="panel profile-panel">
          <ProfileForm profile={profile} />
        </section>
      </main>
    </>
  )
}
