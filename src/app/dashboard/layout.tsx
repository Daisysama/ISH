import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="app-frame">
      <GlobalHeader active="projects" />
      <main className="app-main app-main-with-header">{children}</main>
    </div>
  )
}
