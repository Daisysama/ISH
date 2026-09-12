import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getCurrentAdmin, hasSitePermission } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { AppealCorrectionForm } from '@/frontend/components/memberships/AppealCorrectionForm'
import { ReviewDecisionForm } from '@/frontend/components/memberships/ReviewDecisionForm'

export const metadata = { title: '平台移出申诉 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'
const CATEGORY_LABELS: Record<string, string> = {
  MISTAKE: '可能是误操作', FACT_DISPUTE: '移出理由与事实不符',
  RETALIATION: '疑似恶意或报复性移出', CONTRIBUTION: '涉及作品、贡献或收益', OTHER: '其他',
}
const DECISION_LABELS: Record<string, string> = {
  NO_VIOLATION: '未发现平台违规', RECORD_CORRECTION: '追加官方纠正说明', MISCONDUCT: '认定治理行为不当',
}

export default async function RemovalAppealsPage() {
  const admin = await getCurrentAdmin('APPEAL_REVIEW')
  if (!admin) notFound()
  const [canCorrect, canReviewProjects] = await Promise.all([
    hasSitePermission(admin.id, 'APPEAL_CORRECTION'),
    hasSitePermission(admin.id, 'PROJECT_REVIEW'),
  ])
  const caseScope = {
    recipient: 'PLATFORM' as const,
    appellantUserId: { not: admin.id },
    project: { creatorId: { not: admin.id } },
  }

  const reviewSelect = {
      id: true, status: true, category: true, statement: true, createdAt: true,
      removedAt: true, removedByNameSnapshot: true, removalReasonSnapshot: true,
      decision: true, decisionReason: true, decidedAt: true,
      appellant: { select: { id: true, displayName: true } },
      decidedBy: { select: { id: true, displayName: true } },
      project: { select: { id: true, title: true, summary: true, status: true, creatorId: true, creator: { select: { displayName: true } } } },
      events: {
        where: { type: 'REOPENED' as const }, orderBy: { createdAt: 'asc' as const },
        select: {
          id: true, note: true, createdAt: true, actorUserId: true, deciderUserIdSnapshot: true,
          decisionSnapshot: true, decisionReasonSnapshot: true, deciderNameSnapshot: true,
        },
      },
  } as const
  const [pending, resolved] = await Promise.all([
    db.projectRemovalReview.findMany({
      where: {
        ...caseScope, status: 'PENDING',
        events: { none: { type: 'REOPENED', OR: [{ actorUserId: admin.id }, { deciderUserIdSnapshot: admin.id }] } },
      },
      orderBy: { createdAt: 'asc' },
      select: reviewSelect,
    }),
    db.projectRemovalReview.findMany({
      where: { ...caseScope, status: 'RESOLVED' },
      orderBy: { decidedAt: 'desc' },
      take: 20,
      select: reviewSelect,
    }),
  ])
  const reviews = [...pending, ...resolved]
  const pendingCount = pending.length
  return (
    <>
      <GlobalHeader active="appeals" />
      <main className="moderation-shell shell-with-header">
        <div className="moderation-heading">
          <div><span className="eyebrow">INDEPENDENT REVIEW</span><h1>同行移出申诉</h1><p>平台受理通道独立于项目发起人。原移出理由与处理结论并列留存；平台不默认强制继续私人合作。</p></div>
          <span className="moderation-count">{pendingCount} 条待处理</span>
        </div>
        <div className="moderation-list">
          {reviews.length === 0 && <div className="empty-state compact-empty"><h2>暂无平台申诉。</h2></div>}
          {reviews.map(review => {
            return (
              <article className="moderation-card appeal-case-card" id={`review-${review.id}`} key={review.id}>
                <div className="project-card-meta">
                  <span>{review.status === 'PENDING' ? '待审查' : '已处理'}</span>
                  <time dateTime={review.createdAt.toISOString()}>{review.createdAt.toLocaleString('zh-CN')}</time>
                </div>
                <h2>项目「{review.project.title}」</h2>
                <dl className="appeal-case-people">
                  <div><dt>被移出 · 申诉人</dt><dd>{review.appellant.displayName}</dd></div>
                  <div><dt>执行移出</dt><dd>{review.removedByNameSnapshot}</dd></div>
                  <div><dt>项目发起人</dt><dd>{review.project.creator.displayName}</dd></div>
                  <div><dt>移出时间</dt><dd>{review.removedAt.toLocaleString('zh-CN')}</dd></div>
                </dl>
                <p>项目简介：{review.project.summary}</p>
                <p>原移出理由：{review.removalReasonSnapshot}</p>
                <p>申请类别：{CATEGORY_LABELS[review.category] ?? '其他'} · 申诉说明：{review.statement}</p>
                <p>{review.project.status === 'PUBLISHED' || canReviewProjects
                  ? <Link className="story-link" href={`/projects/${review.project.id}?from=appeals&review=${review.id}`}>查看项目资料 →</Link>
                  : '此项目当前非公开；公开简介已列于上方。'}</p>
                {review.events.map(event => (
                  <div className="notice notice-private" key={event.id}>
                    <strong>裁决已撤销并重审 · {event.createdAt.toLocaleString('zh-CN')}</strong>
                    <p>原裁决：{DECISION_LABELS[event.decisionSnapshot ?? ''] ?? '已留档'} · 原审查员：{event.deciderNameSnapshot ?? '已注销审查员'}</p>
                    <p>原处理依据：{event.decisionReasonSnapshot ?? '未填写'}；撤销原因：{event.note ?? '未填写'}</p>
                  </div>
                ))}
                {review.status === 'PENDING'
                  ? <ReviewDecisionForm reviewId={review.id} recipient="PLATFORM" />
                  : <>
                      <p>现行裁决：{DECISION_LABELS[review.decision ?? ''] ?? '待核对'} · {review.decisionReason} · 审查员：{review.decidedBy?.displayName ?? '已注销管理员'} · {review.decidedAt?.toLocaleString('zh-CN')}</p>
                      {canCorrect && review.decidedBy?.id !== admin.id &&
                        !review.events.some(event => event.actorUserId === admin.id || event.deciderUserIdSnapshot === admin.id) &&
                        <AppealCorrectionForm reviewId={review.id} />}
                    </>}
              </article>
            )
          })}
        </div>
      </main>
    </>
  )
}
