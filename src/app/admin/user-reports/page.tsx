import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentAdmin } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { DecideUserReportForm } from '@/frontend/components/governance/UserReportForms'
import { USER_REPORT_CATEGORY_LABELS } from '@/shared/user-report'

export const metadata = { title: '用户举报审核 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminUserReportsPage() {
  const admin = await getCurrentAdmin('REPORT_REVIEW')
  if (!admin) notFound()
  const reports = await db.userReport.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'asc' }], take: 100,
    include: { reporter: { select: { displayName: true } }, target: { select: { displayName: true } },
      events: { orderBy: { createdAt: 'asc' } }, reviewedBy: { select: { displayName: true } } },
  })
  return <><GlobalHeader active="governance" /><main className="moderation-shell shell-with-header">
    <Link className="page-breadcrumb" href="/admin/governance">← 网站治理</Link>
    <span className="eyebrow">ACCOUNT REPORTS</span><h1>用户举报审核</h1>
    <p>依事实独立审查；举报与审查结果不会自动处分账号。确认需要限制权限时，再到账号处分页单独说明依据。</p>
    {reports.length ? reports.map(item => <article className="panel governance-panel" key={item.id}>
      <p>{item.createdAt.toLocaleString('zh-CN')} · {item.status === 'PENDING' ? '待处理' : item.status === 'WITHDRAWN' ? '举报人已撤回' : '已审结'}</p>
      <h2>被举报：<Link className="user-name-link" href={`/users/${item.targetId}`}>{item.target.displayName}</Link> · 用户 ID：{item.targetId}</h2>
      <p>举报人：{item.reporter.displayName} · 用户 ID：{item.reporterId} · 类别：{USER_REPORT_CATEGORY_LABELS[item.category] ?? '其他'}</p>
      {item.reporterId !== admin.id && item.targetId !== admin.id && <p className="update-body">事实陈述：{item.statement}</p>}
      {item.status === 'PENDING' && (item.targetId === admin.id || item.reporterId === admin.id
        ? <p className="notice notice-danger">您是当事人，必须由另一位网站管理员审查。</p>
        : <DecideUserReportForm reportId={item.id} />)}
      {item.status === 'RESOLVED' && <p>处理人：{item.reviewedBy?.displayName} · 结果：{item.decision === 'NO_VIOLATION' ? '暂未认定违规' : '记录问题，等待单独处分判断'} · {item.decisionReason}</p>}
      {item.reporterId !== admin.id && item.targetId !== admin.id && <details><summary>操作记录</summary>{item.events.map(event => <p key={event.id}>{event.createdAt.toLocaleString('zh-CN')} · 操作用户 ID：{event.actorUserId} · {event.action === 'SUBMITTED' ? '提交举报' : event.action === 'WITHDRAWN' ? '举报人撤回' : '网站审查'} · {event.note}</p>)}</details>}
    </article>) : <section className="empty-state compact-empty"><h2>暂无用户举报。</h2></section>}
  </main></>
}
