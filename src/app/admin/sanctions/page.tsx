import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentAdmin, isSiteOwner } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { IssueSanctionForm, RevokeSanctionForm } from '@/frontend/components/sanctions/SanctionForms'
import { GOVERNANCE_EVENT_LABELS, SANCTION_SCOPE_LABELS } from '@/shared/governance-labels'

export const metadata = { title: '用户处分 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function SiteSanctionsPage() {
  const admin = await getCurrentAdmin('USER_SANCTION')
  if (!admin) notFound()
  const records = await db.userSanction.findMany({ orderBy: { createdAt: 'desc' }, take: 50,
    include: { target: { select: { displayName: true, email: true } },
      issuedBy: { select: { displayName: true } }, events: { orderBy: { createdAt: 'asc' } } } })
  return <><GlobalHeader active="governance" /><main className="moderation-shell shell-with-header">
    <Link className="page-breadcrumb" href="/admin/governance">← 网站治理</Link>
    <span className="eyebrow">USER SAFETY</span><h1>网站账号处分</h1>
    <p>不同站内行为分别限制；站主独占永久全站停用，可随时留痕撤销。本人与站主不能由管理员处分。</p>
    <section className="panel governance-panel"><h2>作出新处分</h2><IssueSanctionForm owner={isSiteOwner(admin.id)} /></section>
    <section className="panel governance-panel"><h2>最近的处理记录</h2>{records.map(item => <article key={item.id} className="governance-rule-item">
      <strong>{item.target.displayName} · 用户 ID：{item.targetId}</strong>
      <p>{SANCTION_SCOPE_LABELS[item.scope]} · {item.status === 'REVOKED' ? '已撤销' : item.expiresAt && item.expiresAt <= new Date() ? '已到期' : '执行中'} · {item.expiresAt ? `至 ${item.expiresAt.toLocaleString('zh-CN')}` : '长期'}</p>
      <p>原操作人：{item.issuedBy.displayName} · 原始依据：{item.reason}</p>
      {item.status === 'REVOKED' && <p>撤销依据：{item.revokeReason}</p>}
      {isSiteOwner(admin.id) && item.status === 'ACTIVE' && <RevokeSanctionForm sanctionId={item.id} />}
      <details><summary>查看操作记录</summary>{item.events.map(event => <p key={event.id}>{event.createdAt.toLocaleString('zh-CN')} · {GOVERNANCE_EVENT_LABELS[event.action] ?? '其他操作'} · 操作用户 ID：{event.actorUserId} · {event.reason}</p>)}</details>
    </article>)}</section>
  </main></>
}
