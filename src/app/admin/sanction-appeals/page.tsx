import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentAdmin } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { DecideSanctionAppealForm } from '@/frontend/components/sanctions/SanctionForms'
import { SANCTION_SCOPE_LABELS } from '@/shared/governance-labels'

export const metadata = { title: '账号处分申诉审查 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function SiteSanctionAppealsPage() {
  const admin = await getCurrentAdmin('SANCTION_APPEAL_REVIEW')
  if (!admin) notFound()
  const appeals = await db.userSanctionAppeal.findMany({ where: { status: 'PENDING', appellantId: { not: admin.id },
    sanction: { issuedById: { not: admin.id } } }, orderBy: { createdAt: 'asc' }, take: 100,
    include: { appellant: { select: { displayName: true } },
      sanction: { include: { issuedBy: { select: { displayName: true } } } } },
  })
  return <><GlobalHeader active="governance" /><main className="moderation-shell shell-with-header">
    <Link className="page-breadcrumb" href="/admin/governance">← 网站治理</Link>
    <span className="eyebrow">INDEPENDENT REVIEW</span><h1>账号处分申诉</h1>
    <p>原处分人不能裁决自己的处分；按提交时间优先处理等待最久的案件。</p>
    {appeals.length === 0 && <section className="empty-state compact-empty"><h2>目前没有您可以独立处理的案件。</h2></section>}
    {appeals.map(item => <article className="panel governance-panel" key={item.id}>
      <h2>{item.appellant.displayName} 的账号申诉</h2>
      <p>原处分人：{item.sanction.issuedBy.displayName} · 原范围：{SANCTION_SCOPE_LABELS[item.sanction.scope]} · 原有效期：{item.sanction.expiresAt?.toLocaleString('zh-CN') ?? '长期'}</p>
      <p>原处分依据：{item.reasonSnapshot}</p><p className="update-body">申诉说明：{item.statement}</p>
      <DecideSanctionAppealForm appealId={item.id} />
    </article>)}
  </main></>
}
