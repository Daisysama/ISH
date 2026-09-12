import Link from 'next/link'

import { logoutAction } from '@/backend/auth/actions'
import { getSiteAccess } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { getCurrentUser } from '@/backend/auth/current-user'
import { countUnreadNotifications } from '@/backend/notifications/queries'
import { getRemovalReviewNoticeCounts } from '@/backend/removal-reviews/queries'
import { getResponseCenterCounts } from '@/backend/responses/queries'
import { BrandIdentity } from '@/frontend/components/brand/BrandIdentity'

type GlobalHeaderProps = {
  active?: 'plaza' | 'meow' | 'projects' | 'moderation' | 'appeals' | 'governance' | 'governance-log' | 'notifications' | 'reports' | 'content-rules' | 'announcements' | 'announcements-admin' | 'sanctions' | 'sanction-appeals' | 'account-limit'
}

export async function GlobalHeader({ active }: GlobalHeaderProps) {
  const user = await getCurrentUser()
  const access = user ? await getSiteAccess(user.id) : null
  const canReviewProjects = access?.permissions.includes('PROJECT_REVIEW') ?? false
  const canReviewAppeals = access?.permissions.includes('APPEAL_REVIEW') ?? false
  const canUseGovernance = Boolean(access && access.role !== 'USER')
  const activeSanctions = user ? await db.userSanction.findMany({ where: { targetId: user.id, status: 'ACTIVE',
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { scope: true } }) : []
  const siteClosed = activeSanctions.some((sanction) => sanction.scope === 'SITE')
  const [reviewNotices, unreadNotices, responseNotices] = user ? await Promise.all([
    getRemovalReviewNoticeCounts(user.id, canReviewAppeals), countUnreadNotifications(user.id), getResponseCenterCounts(user.id),
  ]) : [null, 0, null]
  const projectNoticeCount = reviewNotices ? reviewNotices.founderPending + reviewNotices.newResults : 0

  return (
    <header className="global-header">
      <div className="global-header-inner">
        <BrandIdentity href="/" compact />

        <nav className="global-nav" aria-label="主导航">
          {siteClosed ? (
            <>
              <Link className={active === 'account-limit' ? 'is-active' : undefined} href="/account/limited">账号状态与申诉</Link>
              <Link className={active === 'notifications' ? 'is-active' : undefined} href="/notifications">消息{unreadNotices > 0 && <span className="nav-alert-count">{unreadNotices}</span>}</Link>
            </>
          ) : (
            <>
          <Link className={active === 'plaza' ? 'is-active' : undefined} href="/projects">
            羊群广场
          </Link>
          <Link className={active === 'announcements' ? 'is-active' : undefined} href="/announcements">ISH 公告</Link>
          <Link
            className={active === 'meow' ? 'is-active' : undefined}
            href={user ? '/meow/new' : '/register'}
          >
            咩一个
          </Link>
          {user && (
            <Link className={active === 'projects' ? 'is-active' : undefined} href="/dashboard">
              我的项目
              {projectNoticeCount + (responseNotices?.total ?? 0) > 0 && <span className="nav-alert-count" title={`${responseNotices?.pendingIncoming ?? 0} 条待回应，${responseNotices?.unreadOutgoing ?? 0} 条新结果，${projectNoticeCount} 条同行核查提醒`}>{projectNoticeCount + (responseNotices?.total ?? 0)}</span>}
            </Link>
          )}
          {canReviewProjects && (
            <Link className={active === 'moderation' ? 'is-active' : undefined} href="/admin/moderation">项目审核</Link>
          )}
          {canReviewAppeals && (
            <Link className={active === 'appeals' ? 'is-active' : undefined} href="/admin/removal-appeals">
              申诉审查{reviewNotices && reviewNotices.platformPending > 0 && <span className="nav-alert-count">{reviewNotices.platformPending}</span>}
            </Link>
          )}
          {canUseGovernance && <Link className={active === 'governance' || active === 'governance-log' ? 'is-active' : undefined} href="/admin/governance">治理</Link>}
          {user && <Link className={active === 'notifications' ? 'is-active' : undefined} href="/notifications">消息{unreadNotices > 0 && <span className="nav-alert-count">{unreadNotices}</span>}</Link>}
          {activeSanctions.length > 0 && <Link className={active === 'account-limit' ? 'is-active' : undefined} href="/account/limited">账号限制</Link>}
            </>
          )}
        </nav>

        <div className="global-header-actions">
          {user ? (
            <>
              <Link className="global-account" href={siteClosed ? '/account/limited' : '/profile'}>
                <span className="avatar">{user.displayName.slice(0, 1)}</span>
                <span className="global-account-copy">
                  <strong>{user.displayName}{access?.role === 'OWNER' ? ' · 站主' : ''}</strong>
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
