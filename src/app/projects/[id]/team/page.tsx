import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { getProjectTeamState } from '@/backend/memberships/queries'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { LeaveProjectForm } from '@/frontend/components/memberships/LeaveProjectForm'
import { RemoveMemberForm } from '@/frontend/components/memberships/RemoveMemberForm'
import { MemberPermissionsForm } from '@/frontend/components/memberships/MemberPermissionsForm'
import { CollaborationProfile } from '@/frontend/components/profile/CollaborationProfile'
import { ReviewDecisionForm, RestoreRemovedMemberForm } from '@/frontend/components/memberships/ReviewDecisionForm'

export const metadata = { title: '项目同行者 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ id: string }> }

export default async function ProjectTeamPage({ params }: PageProps) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { id } = await params
  const project = await getProjectTeamState(id, user.id)
  if (!project) notFound()

  const isOwner = project.creatorId === user.id
  const viewerIsActiveMember = project.viewerMembership?.status === 'ACTIVE'
  if (!isOwner && !viewerIsActiveMember) notFound()

  return (
    <>
      <GlobalHeader active="projects" />
      <main className="team-page-shell shell-with-header">
        <Link className="page-breadcrumb" href="/dashboard">← 我的项目</Link>

        <section className="team-page-heading">
          <div>
            <span className="eyebrow">PROJECT TEAM / 同行者</span>
            <h1>{project.title}</h1>
            <p>加入、退出和移除都保留历史。完整移除理由只留在项目内部，不自动公开给羊群广场。</p>
          </div>
          <Link className="button button-quiet button-compact" href={`/projects/${project.id}?from=dashboard`}>查看项目</Link>
        </section>

        <section className="panel team-panel">
          <div className="section-title-row team-section-heading">
            <div><span className="eyebrow">ACTIVE · {project.memberships.length}</span><h2>正在同行的羊</h2></div>
            {isOwner && <p>移除是一项高影响操作，所以必须说明理由并永久留痕。</p>}
          </div>

          {project.memberships.length === 0 ? (
            <div className="empty-state compact-empty"><h3>现在还没有同行者。</h3><p>有人响应并被接受以后，会出现在这里。</p></div>
          ) : (
            <div className="team-member-list">
              {project.memberships.map(member => (
                <details className="team-member-card" key={member.id}>
                  <summary>
                    <div>
                      <strong>{member.user.displayName}</strong>
                      <span>{member.roles.length ? member.roles.join(' · ') : '同行者'} · {member.joinedAt.toLocaleDateString('zh-CN')} 加入 · {member.permissions.includes('SUBMIT_UPDATES') ? '可提交动态' : '当前只读'}</span>
                    </div>
                    <span>{isOwner ? '管理' : '查看'}</span>
                  </summary>
                  <div className="team-member-body"><CollaborationProfile user={member.user} currentProjectId={project.id} returnTo={`/projects/${project.id}/team`} />
                    {isOwner ? (
                      <>
                        <MemberPermissionsForm key={`${member.id}:${member.permissions.join(',')}`} membershipId={member.id} currentPermissions={member.permissions} />
                        <RemoveMemberForm membershipId={member.id} displayName={member.user.displayName} />
                      </>
                    ) : (
                      <p className="team-readonly-note">成员权限由项目发起人管理。这里展示当前团队关系与加入时间。</p>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>

        {isOwner && project.removalReviews.length > 0 && (
          <section className="panel project-activity-panel">
            <div className="section-title-row team-section-heading">
              <div><span className="eyebrow">FOUNDER REVIEW · {project.removalReviews.length}</span><h2>待核查的移出</h2></div>
              <p>这里只显示向发起人提出的核查。提交给网站管理员的独立申诉不会在这里披露。</p>
            </div>
            <div className="project-activity-list">
              {project.removalReviews.map(review => (
                <article className="project-activity-item" key={review.id}>
                  <div><strong>{review.appellant.displayName} 请求核查</strong><time dateTime={review.createdAt.toISOString()}>{review.createdAt.toLocaleString('zh-CN')}</time></div>
                  <p>{review.statement}</p>
                  <ReviewDecisionForm reviewId={review.id} recipient="FOUNDER" />
                </article>
              ))}
            </div>
          </section>
        )}

        {isOwner && project.removedMemberships.length > 0 && (
          <section className="panel project-activity-panel">
            <div className="section-title-row team-section-heading">
              <div><span className="eyebrow">REMOVED · {project.removedMemberships.length}</span><h2>已移出的同行者</h2></div>
              <p>发现误操作时可主动恢复；历史移出事实仍留在内部活动中。</p>
            </div>
            <div className="project-activity-list">
              {project.removedMemberships.map(member => (
                <article className="project-activity-item" key={member.id}>
                  <div><strong>{member.user.displayName}</strong><time>{member.leftAt?.toLocaleString('zh-CN') ?? '时间未知'}</time></div>
                  <p>原移出理由：{member.departureReason ?? '未提供理由'}</p>
                  <RestoreRemovedMemberForm membershipId={member.id} />
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="panel project-activity-panel">
          <div className="section-title-row team-section-heading">
            <div><span className="eyebrow">PROJECT ACTIVITY</span><h2>项目内部活动</h2></div>
            <p>这是团队内部协作记录，不是对外公开的项目动态。</p>
          </div>

          {project.activities.length === 0 ? (
            <div className="empty-state compact-empty"><h3>还没有内部活动记录。</h3></div>
          ) : (
            <div className="project-activity-list">
              {project.activities.map(activity => (
                <article className="project-activity-item" key={activity.id}>
                  <div>
                    <strong>{activity.summary}</strong>
                    <time dateTime={activity.createdAt.toISOString()}>{activity.createdAt.toLocaleString('zh-CN')}</time>
                  </div>
                  {activity.reason && <p><strong>说明：</strong>{activity.reason}</p>}
                  {activity.actor?.displayName && <span>操作人：{activity.actor.displayName}</span>}
                </article>
              ))}
            </div>
          )}
        </section>

        {!isOwner && viewerIsActiveMember && <LeaveProjectForm projectId={project.id} />}
      </main>
    </>
  )
}
