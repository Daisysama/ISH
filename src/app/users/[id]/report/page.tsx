import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/backend/auth/current-user'
import { resolveUserId } from '@/backend/profile/resolve-user'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { SubmitUserReportForm, WithdrawUserReportForm } from '@/frontend/components/governance/UserReportForms'
import { USER_REPORT_CATEGORY_LABELS } from '@/shared/user-report'
import { safePublicProfileReturn } from '@/shared/user-navigation'

export const metadata = { title: '用户举报 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ReportUserPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string | string[] }>
}) {
  const { id } = await params
  const targetId = await resolveUserId(id)
  if (!targetId) notFound()
  const viewer = await getCurrentUser()
  if (!viewer) redirect('/login')
  if (viewer.id === targetId) notFound()
  const [target, reports] = await Promise.all([
    db.user.findUnique({ where: { id: targetId }, select: { displayName: true } }),
    db.userReport.findMany({ where: { reporterId: viewer.id, targetId }, orderBy: { createdAt: 'desc' }, take: 15,
      select: { id: true, category: true, statement: true, status: true, decision: true, decisionReason: true, createdAt: true } }),
  ])
  if (!target) notFound()
  const returnTo = safePublicProfileReturn((await searchParams).returnTo)
  return <><GlobalHeader /><main className="profile-shell shell-with-header public-user-page">
    <Link className="page-breadcrumb" href={`/users/${id}?${new URLSearchParams({ returnTo })}`}>← {target.displayName} 的资料</Link>
    <section className="panel profile-panel"><span className="eyebrow">ACCOUNT REPORT</span><h1>举报此用户</h1>
      <p>被举报人：{target.displayName}。平台管理员独立核查；举报不会自动认定对方违规或直接封号。</p>
      <SubmitUserReportForm targetId={targetId} />
    </section>
    <section className="panel profile-panel"><h2>我的举报记录</h2>
      {reports.length ? reports.map(item => <article className="governance-rule-item" key={item.id}>
        <strong>{item.status === 'PENDING' ? '等待独立审核' : item.status === 'WITHDRAWN' ? '已撤回' : '已审结'}</strong>
        <p>{item.createdAt.toLocaleString('zh-CN')} · {USER_REPORT_CATEGORY_LABELS[item.category] ?? '其他'}</p><p className="update-body">{item.statement}</p>
        {item.decisionReason && <p>审核结论：{item.decision === 'NO_VIOLATION' ? '暂未认定违规' : '转单独处分流程'} · {item.decisionReason}</p>}
        {item.status === 'PENDING' && <WithdrawUserReportForm reportId={item.id} />}
      </article>) : <p>暂无相关举报。</p>}
    </section>
  </main></>
}
