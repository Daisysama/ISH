import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { RemovalDecisionSeenMarker } from '@/frontend/components/memberships/RemovalDecisionSeenMarker'
import { RemovalReviewForm } from '@/frontend/components/memberships/RemovalReviewForm'
import { resolveProjectReturn } from '@/shared/navigation'

export const metadata = { title: '移出核查与申诉 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function RemovalReviewPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ from?: string | string[] }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const { id } = await params
  const source = searchParams ? await searchParams : {}
  const returnTarget = resolveProjectReturn(source.from, 'dashboard')
  const membership = await db.projectMembership.findUnique({
    where: { projectId_userId: { projectId: id, userId: user.id } },
    select: {
      status: true, leftAt: true, departureReason: true,
      removedBy: { select: { displayName: true } },
      project: { select: { id: true, title: true, creator: { select: { displayName: true } } } },
      removalRecords: {
        orderBy: { removedAt: 'desc' },
        take: 1,
        select: {
          id: true, removedAt: true, removedByNameSnapshot: true, reasonSnapshot: true,
        },
      },
      removalReviews: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, removalId: true, removedAt: true, removedByNameSnapshot: true, removalReasonSnapshot: true,
          recipient: true, category: true, statement: true, createdAt: true,
          status: true, decision: true, decisionReason: true, decidedAt: true, appellantDecisionSeenAt: true,
          events: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true, type: true, note: true, createdAt: true,
              decisionSnapshot: true, decisionReasonSnapshot: true, deciderNameSnapshot: true,
              actor: { select: { displayName: true } },
            },
          },
        },
      },
    },
  })
  if (!membership || membership.removalRecords.length === 0) notFound()
  const latestRemoval = membership.removalRecords[0]
  const currentReviews = membership.removalReviews.filter(review => review.removalId === latestRemoval.id)

  return (
    <>
      <GlobalHeader active="projects" />
      <main className="team-page-shell shell-with-header">
        <RemovalDecisionSeenMarker
          projectId={id}
          shouldMark={membership.removalReviews.some(review => review.status === 'RESOLVED' && !review.appellantDecisionSeenAt)}
        />
        <Link className="page-breadcrumb" href={returnTarget.href}>← {returnTarget.label}</Link>
        <section className="team-page-heading">
          <div>
            <span className="eyebrow">MEMBERSHIP REVIEW / 同行关系</span>
            <h1>移出核查与申诉</h1>
            <p>项目「{membership.project.title}」的历史同行关系不会被删除。发起人核查与平台申诉是两条独立通道，您可以直接选择平台。</p>
          </div>
        </section>
        <section className="panel removal-review-receipt">
            <h2>本次移出记录</h2>
            {membership.status === 'ACTIVE' && <p>同行关系后来已恢复；您仍可就此前移出提出复核。</p>}
            <p>操作人：{latestRemoval.removedByNameSnapshot}</p>
            <p>时间：{latestRemoval.removedAt.toLocaleString('zh-CN')}</p>
            <p>原始理由：{latestRemoval.reasonSnapshot}</p>
            <p>原始理由和既往贡献记录不会因复核而被覆盖；处理结论会作为新的记录追加。</p>
        </section>
        <div className="removal-review-options">
            {(['FOUNDER', 'PLATFORM'] as const).map(recipient => {
              const existing = currentReviews.find(review => review.recipient === recipient)
              return (
                <section className="panel removal-review-option" key={recipient}>
                  <span className="eyebrow">{recipient === 'PLATFORM' ? 'INDEPENDENT APPEAL' : 'DIRECT REVIEW'}</span>
                  <h2>{recipient === 'PLATFORM' ? '向网站管理员申诉' : '请项目发起人核查'}</h2>
                  <p>{recipient === 'PLATFORM'
                    ? '适合怀疑恶意、报复或贡献权益受损的情况。发起人不能查看您的平台申诉内容，也不能处理自己的案件。平台不默认强制双方继续合作。'
                    : '适合误点、信息沟通不全等情况。发起人可说明理由或恢复同行；不影响您另行向平台申诉。'}</p>
                  {existing ? (
                    <p className="review-existing-state">已提交 · {existing.status === 'PENDING' ? '待处理' : '已处理；处理结果见下方记录'}</p>
                  ) : <RemovalReviewForm removalId={latestRemoval.id} recipient={recipient} />}
                </section>
              )
            })}
        </div>
        {membership.removalReviews.length > 0 && (
          <section className="panel project-activity-panel">
            <h2>我的申请与处理记录</h2>
            <div className="project-activity-list">
              {membership.removalReviews.map(review => (
                <article className="project-activity-item" key={review.id}>
                  <div>
                    <strong>{review.recipient === 'PLATFORM' ? '平台申诉' : '发起人核查'} · {review.status === 'PENDING' ? '待处理' : '已处理'}</strong>
                    {review.status === 'RESOLVED' && !review.appellantDecisionSeenAt && <span className="review-new-result">新结果</span>}
                    <time dateTime={review.createdAt.toISOString()}>{review.createdAt.toLocaleString('zh-CN')}</time>
                  </div>
                  <p>原始移出：{review.removedByNameSnapshot} 于 {review.removedAt.toLocaleString('zh-CN')} 移出；理由：{review.removalReasonSnapshot}</p>
                  <p>您的说明：{review.statement}</p>
                  {review.decision && <p>处理结论：{review.decision === 'RESTORED' ? '恢复同行' : review.decision === 'DECLINED' ? '维持移出' : review.decision === 'NO_VIOLATION' ? '未发现平台违规' : review.decision === 'RECORD_CORRECTION' ? '官方纠正说明' : '认定治理行为不当'}</p>}
                  {review.decisionReason && <p>处理依据：{review.decisionReason}</p>}
                  <div className="review-audit-events">
                    {review.events.map(event => (
                      <p key={event.id}>
                        {event.type === 'SUBMITTED' ? '提交申诉' : event.type === 'REOPENED' ? '撤销原裁决，重新审查' : '作出裁决'}
                        {' · '}{event.actor?.displayName ?? '已注销用户'} · {event.createdAt.toLocaleString('zh-CN')}
                        {event.type === 'REOPENED' && (
                          <span>；撤销原因：{event.note ?? '未填写'}；原审查员：{event.deciderNameSnapshot ?? '已注销用户'}；原裁决：{event.decisionSnapshot === 'NO_VIOLATION' ? '未发现平台违规' : event.decisionSnapshot === 'RECORD_CORRECTION' ? '官方纠正说明' : '认定治理行为不当'}；原处理依据：{event.decisionReasonSnapshot ?? '未填写'}</span>
                        )}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  )
}
