import Link from 'next/link'

import { logoutAction } from '@/backend/auth/actions'
import { isAdminEmail } from '@/backend/auth/admin'
import { getCurrentUser } from '@/backend/auth/current-user'
import { BrandIdentity } from '@/frontend/components/brand/BrandIdentity'

type GlobalHeaderProps = {
  active?: 'plaza' | 'meow' | 'projects' | 'moderation'
}

export async function GlobalHeader({ active }: GlobalHeaderProps) {
  const user = await getCurrentUser()
  const isAdmin = user ? isAdminEmail(user.email) : false

  return (
    <header className="global-header">
      <div className="global-header-inner">
        <BrandIdentity href="/" compact />

        <nav className="global-nav" aria-label="主导航">
          <Link className={active === 'plaza' ? 'is-active' : undefined} href="/projects">
            羊群广场
          </Link>
          <Link
            className={active === 'meow' ? 'is-active' : undefined}
            href={user ? '/meow/new' : '/register'}
          >
            咩一个
          </Link>
          {user && (
            <Link className={active === 'projects' ? 'is-active' : undefined} href="/dashboard">
              我的项目
            </Link>
          )}
          {isAdmin && (
            <Link
              className={active === 'moderation' ? 'is-active' : undefined}
              href="/admin/moderation"
            >
              审核
            </Link>
          )}
        </nav>

        <div className="global-header-actions">
          {user ? (
            <>
              <Link className="global-account" href="/dashboard">
                <span className="avatar">{user.displayName.slice(0, 1)}</span>
                <span className="global-account-copy">
                  <strong>{user.displayName}</strong>
                  <small>{user.email}</small>
                </span>
              </Link>
              <form action={logoutAction}>
                <button className="button button-quiet button-compact" type="submit">
                  退出
                </button>
              </form>
            </>
          ) : (
            <>
              <Link className="button button-quiet button-compact" href="/login">
                登录
              </Link>
              <Link className="button button-primary button-compact" href="/register">
                加入羊群
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
