import { redirect } from 'next/navigation'

import { logoutAction } from '@/backend/auth/actions'
import { getCurrentUser } from '@/backend/auth/current-user'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // middleware 已经挡过一次未登录的请求了，这里再查一次是因为
  // middleware 只验证 token 有没有过期，不知道这个账号是不是还存在。
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <div className="brandmark">ISH</div>
          <p className="brand-name">伊始</p>
        </div>

        <div className="app-user">
          <span className="avatar">{user.displayName.slice(0, 1)}</span>
          <div>
            <div>{user.displayName}</div>
            <div className="app-user-email">{user.email}</div>
          </div>
          <form action={logoutAction}>
            <button className="btn btn-ghost" type="submit">
              退出登录
            </button>
          </form>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </>
  )
}
