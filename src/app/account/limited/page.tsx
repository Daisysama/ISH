import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { AppealSanctionForm } from '@/frontend/components/sanctions/SanctionForms'
import { SANCTION_SCOPE_LABELS } from '@/shared/governance-labels'

export const metadata = { title: '账号状态与申诉 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function MyAccountLimitPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const records = await db.userSanction.findMany({ where: { targetId: user.id }, orderBy: { createdAt: 'desc' }, take: 50,
    include: { appeal: { select: { id: true, statement: true, status: true, decision: true, decisionReason: true, reviewedAt: true } } } })
  return <><GlobalHeader active="account-limit" /><main className="moderation-shell shell-with-header">
    <span className="eyebrow">ACCOUNT STATUS</span><h1>我的账号状态</h1>
    <p>如被全站停用，您仍可查看自己的处分与站内消息，并向独立的网站管理员提出申诉；处分不会抹掉历史记录。</p>
    {records.length === 0 && <section className="empty-state compact-empty"><h2>账号目前没有处分记录。</h2></section>}
    {records.map(item => <section className="panel governance-panel" key={item.id}>
      <h2>{SANCTION_SCOPE_LABELS[item.scope]}</h2>
      <p>状态：{item.status === 'REVOKED' ? '已撤销' : item.expiresAt && item.expiresAt <= new Date() ? '已到期' : '执行中'} · {item.expiresAt ? `截止 ${item.expiresAt.toLocaleString('zh-CN')}` : '长期有效'}</p>
      <p>处分依据：{item.reason}</p>{item.revokeReason && <p>撤销依据：{item.revokeReason}</p>}
      {item.appeal ? <section className="governance-rule-item"><strong>我的申诉 · {item.appeal.status === 'PENDING' ? '等待独立审查' : '已处理'}</strong>
        <p>{item.appeal.statement}</p>{item.appeal.decisionReason && <p>处理结论：{item.appeal.decision === 'REVOKED' ? '撤销原处分' : '维持原处分'} · {item.appeal.decisionReason}</p>}
      </section> : <AppealSanctionForm sanctionId={item.id} />}
    </section>)}
  </main></>
}
