import Link from 'next/link'

type Review = {
  id: string
  recipient: 'FOUNDER' | 'PLATFORM'
  status: 'PENDING' | 'RESOLVED'
  decision: string | null
  decisionReason: string | null
  removedAt: Date
}

export function RemovalNotice({
  projectId, removedAt, reason, actorName, reviews,
}: {
  projectId: string
  removedAt: Date | null
  reason: string | null
  actorName: string
  reviews: Review[]
}) {
  const currentReviews = reviews.filter(review => review.removedAt.getTime() === removedAt?.getTime())
  return (
    <section className="notice notice-danger membership-departure-notice">
      <strong>您已被移出这个项目。</strong>
      <p>由 {actorName} 移出{removedAt ? ` · ${removedAt.toLocaleString('zh-CN')}` : ''}</p>
      <p>移出原因：{reason ?? '未提供理由'}</p>
      {currentReviews.map(review => (
        <p key={review.id}>
          {review.recipient === 'PLATFORM' ? '平台申诉' : '发起人核查'}：
          {review.status === 'PENDING' ? '待处理' : `已处理 · ${review.decisionReason ?? '见申请记录'}`}
        </p>
      ))}
      <div className="removal-notice-actions">
        <Link className="button button-quiet button-compact" href={`/projects/${projectId}/removal-review`}>核查 / 向平台申诉</Link>
        <Link className="story-link" href="/dashboard">返回我的项目 →</Link>
      </div>
    </section>
  )
}
