import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { listActiveMembershipsForUser, listHistoricalMembershipsForUser } from '@/backend/memberships/queries'
import { listProjectsForCreator } from '@/backend/projects/queries'
import { getRemovalReviewDashboardNotices } from '@/backend/removal-reviews/queries'
import { getResponseCenterCounts } from '@/backend/responses/queries'
import { ProjectStatusBadge } from '@/frontend/components/projects/ProjectStatusBadge'
import { projectHref } from '@/shared/navigation'
import { publicUserHref } from '@/shared/user-navigation'

export const metadata = { title: '我的羊群 · FromISH' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [projects, memberships, historicalMemberships, responseCounts, reviewNotices] = await Promise.all([
    listProjectsForCreator(user.id),
    listActiveMembershipsForUser(user.id),
    listHistoricalMembershipsForUser(user.id),
    getResponseCenterCounts(user.id),
    getRemovalReviewDashboardNotices(user.id),
  ])
  const removedCount = historicalMemberships.filter(membership => membership.status === 'REMOVED').length


  return (
    <div className="dashboard-stack">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">YOUR TRAIL</span>
          <h1>{user.displayName}，今天想咩点什么？</h1>
          <p>这里记录您发出的每一声咩。审核状态、公开结果和退回原因都会留在原地。</p>
        </div>
        <div className="dashboard-hero-actions">
          <Link className="button button-quiet" href="/dashboard/responses">
            回应中心{responseCounts.total > 0 ? ` · ${responseCounts.total}` : ''}
          </Link>
          <Link className="button button-primary" href="/meow/new">
            咩一个想法 <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {reviewNotices.results.length > 0 && (
        <div className="notice membership-dashboard-alert" role="status">
          <strong>您有 {reviewNotices.results.length} 条移出核查或平台申诉的新处理结果。</strong>
          <div className="review-notice-links">
            {reviewNotices.results.map(review => (
              <Link key={review.id} href={`/projects/${review.project.id}/removal-review`}>
                查看「{review.project.title}」的{review.recipient === 'PLATFORM' ? '平台申诉' : '发起人核查'}结果 →
              </Link>
            ))}
          </div>
        </div>
      )}
      {reviewNotices.founderPending.length > 0 && (
        <div className="notice membership-dashboard-alert" role="status">
          <strong>您有 {reviewNotices.founderPending.length} 条同行者移出核查待处理。</strong>
          <div className="review-notice-links">
            {reviewNotices.founderPending.map(review => (
              <Link key={review.id} href={`/projects/${review.project.id}/team`}>
                前往「{review.project.title}」的同行者页 →
              </Link>
            ))}
          </div>
        </div>
      )}

      {removedCount > 0 && (
        <div className="notice notice-danger membership-dashboard-alert">
          <strong>您有 {removedCount} 个项目的同行关系被移出。</strong>
          {' '}原因、时间和核查入口保留在下方的 <a href="#historical-projects">历史项目</a> 中。
        </div>
      )}

      <section>
        <div className="section-title-row dashboard-section-title">
          <div>
            <span className="eyebrow">我发起的</span>
            <h2>每一声咩，都有它自己的路。</h2>
          </div>
          <Link className="story-link" href="/projects">
            去羊群广场 <span aria-hidden="true">→</span>
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state compact-empty empty-state-warm">
            <h3>您的第一声咩还没发出来。</h3>
            <p>不用写商业计划书。先把想做什么说清楚，就已经是一个开始。</p>
            <Link className="button button-primary button-compact" href="/meow/new">
              去咩一个
            </Link>
          </div>
        ) : (
          <div className="dashboard-project-list">
            {projects.map((project, index) => (
              <article className="dashboard-project" key={project.id}>
                <div className={`dashboard-project-orb dashboard-project-orb-${index % 3}`} aria-hidden="true" />
                <div className="dashboard-project-main">
                  <div className="dashboard-project-title-row">
                    <h3>
                      <Link href={projectHref(project.id, 'dashboard')}>{project.title}</Link>
                    </h3>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <p>{project.summary}</p>
                  {project.status === 'REJECTED' && project.rejectionReason && (
                    <p className="rejection-preview">
                      <strong>退回原因：</strong> {project.rejectionReason}
                    </p>
                  )}
                  <div className="dashboard-member-summary">
                    <strong>本项目同行者 · {project.memberships.length}</strong>
                    {project.memberships.length > 0 ? (
                      <div className="dashboard-member-list">
                        {project.memberships.slice(0, 5).map((membership) => (
                          <span key={membership.id}>
                            {membership.user.displayName}
                            {membership.roles.length > 0 ? ` · ${membership.roles.join(' / ')}` : ''}
                          </span>
                        ))}
                        {project.memberships.length > 5 && <span>+{project.memberships.length - 5} 位</span>}
                      </div>
                    ) : (
                      <p>还没有同行者。有人响应并被您接受后，会出现在这里。</p>
                    )}
                  </div>
                  {project.revisions[0]?.status === 'PENDING' && (
                    <p className="dashboard-revision-state">V{project.revisions[0].version} 修改审核中 · 当前公开 V{project.version}</p>
                  )}
                  {project.revisions[0]?.status === 'REJECTED' && (
                    <p className="dashboard-revision-state dashboard-revision-state-danger">V{project.revisions[0].version} 修改被退回，可以继续修改后再提交。</p>
                  )}
                </div>
                <div className="dashboard-project-actions">
                  <Link className="button button-quiet button-compact" href={projectHref(project.id, 'dashboard')}>
                    查看
                  </Link>
                  {project.status === 'PUBLISHED' && (() => {
                    const revision = project.revisions[0]
                    const label = revision?.status === 'PENDING'
                      ? '查看修改'
                      : revision?.status === 'REJECTED'
                        ? '继续修改'
                        : '修改'
                    return (
                      <Link className="button button-primary button-compact" href={`/projects/${project.id}/edit`}>
                        {label}
                      </Link>
                    )
                  })()}
                  <Link className="button button-quiet button-compact dashboard-team-action" href={`/projects/${project.id}/team`}>
                    同行者
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="section-title-row dashboard-section-title">
          <div>
            <span className="eyebrow">我同行的</span>
            <h2>被听见以后，项目也会成为您的路。</h2>
          </div>
        </div>

        {memberships.length === 0 ? (
          <div className="empty-state compact-empty">
            <h3>您还没有加入其他项目。</h3>
            <p>看到想参与的项目，可以回一声“咩”。被发起人接受后，它会出现在这里。</p>
            <Link className="story-link" href="/projects">去羊群广场 →</Link>
          </div>
        ) : (
          <div className="dashboard-project-list">
            {memberships.map((membership, index) => (
              <article className="dashboard-project" key={membership.id}>
                <div className={`dashboard-project-orb dashboard-project-orb-${(index + projects.length) % 3}`} aria-hidden="true" />
                <div className="dashboard-project-main">
                  <div className="dashboard-project-title-row">
                    <h3><Link href={projectHref(membership.project.id, 'dashboard')}>{membership.project.title}</Link></h3>
                    <ProjectStatusBadge status={membership.project.status} />
                  </div>
                  <p>{membership.project.summary}</p>
                  <div className="dashboard-member-summary">
                    <strong>发起人：<Link className="user-name-link" href={publicUserHref(membership.project.creator.uid, '/dashboard')}>{membership.project.creator.displayName}</Link></strong>
                    <div className="dashboard-member-list">
                      <span>我的同行身份：{membership.roles.length ? membership.roles.join(' / ') : '同行者'}</span>
                      <span>{membership.permissions.includes('SUBMIT_UPDATES') ? '可提交项目动态（审核后公开）' : '当前权限：只读'}</span>
                      {membership.removalReviews[0] && (
                        <span>此前移出平台申诉：{membership.removalReviews[0].status === 'PENDING' ? '待处理' : '已处理'}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="dashboard-project-actions">
                  <Link className="button button-quiet button-compact" href={projectHref(membership.project.id, 'dashboard')}>查看</Link>
                  <Link className="button button-quiet button-compact" href={`/projects/${membership.project.id}/team`}>同行者</Link>
                  {membership.project.status === 'PUBLISHED' && membership.permissions.includes('SUBMIT_UPDATES') && (
                    <Link className="button button-primary button-compact" href={`/projects/${membership.project.id}/updates/new?from=dashboard`}>发动态</Link>
                  )}
                  {membership.removalRecords.length > 0 && (
                    <Link className="button button-quiet button-compact" href={`/projects/${membership.project.id}/removal-review`}>历史移出 / 申诉</Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section id="historical-projects">
        <div className="section-title-row dashboard-section-title">
          <div>
            <span className="eyebrow">历史项目 · {historicalMemberships.length}</span>
            <h2>同行结束，经历不会消失。</h2>
          </div>
        </div>
        {historicalMemberships.length === 0 ? (
          <div className="empty-state compact-empty"><p>暂时没有已退出或被移出的项目。</p></div>
        ) : (
          <div className="dashboard-project-list">
            {historicalMemberships.map((membership, index) => {
              const currentReviews = membership.removalReviews.filter(
                (review) => review.removedAt.getTime() === membership.leftAt?.getTime(),
              )
              return (
                <article className="dashboard-project dashboard-history-project" key={membership.id}>
                  <div className={`dashboard-project-orb dashboard-project-orb-${index % 3}`} aria-hidden="true" />
                  <div className="dashboard-project-main">
                    <div className="dashboard-project-title-row">
                      <h3><Link href={projectHref(membership.project.id, 'dashboard')}>{membership.project.title}</Link></h3>
                      <span className={membership.status === 'REMOVED' ? 'history-status history-status-removed' : 'history-status'}>
                        {membership.status === 'REMOVED' ? '被移出' : '已退出'}
                      </span>
                    </div>
                    <p>{membership.project.summary}</p>
                    <p className="history-detail">
                      {membership.status === 'REMOVED' ? `由 ${membership.removedBy?.displayName ?? membership.project.creator.displayName} 移出` : '您主动退出'}
                      {membership.leftAt ? ` · ${membership.leftAt.toLocaleString('zh-CN')}` : ''}
                    </p>
                    {membership.status === 'REMOVED' && <p className="history-detail">移出原因：{membership.departureReason ?? '未提供理由'}</p>}
                    {currentReviews.length > 0 && (
                      <p className="history-detail">
                        {currentReviews.map(review => `${review.recipient === 'PLATFORM' ? '平台申诉' : '发起人核查'}：${review.status === 'PENDING' ? '待处理' : '已处理'}`).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="dashboard-project-actions">
                    <Link className="button button-quiet button-compact" href={projectHref(membership.project.id, 'dashboard')}>查看记录</Link>
                    {membership.status === 'REMOVED' && (
                      <Link className="button button-primary button-compact" href={`/projects/${membership.project.id}/removal-review`}>核查 / 申诉</Link>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
