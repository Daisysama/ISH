import { notFound } from 'next/navigation'
import Link from 'next/link'

import { getCurrentAdmin, isSiteOwner } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { ClearUpdatePolicyForm, ScreeningRuleForm } from '@/frontend/components/governance/ScreeningRuleForm'
import { formatRuleSnapshot } from '@/shared/governance-labels'

export const metadata = { title: '内容筛查规则 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ScreeningRulesPage() {
  const admin = await getCurrentAdmin('CONTENT_POLICY')
  if (!admin) notFound()
  const [rules, events, policy, policyEvents] = await Promise.all([
    db.screeningRule.findMany({ orderBy: { createdAt: 'desc' } }),
    db.screeningRuleEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    db.contentScreeningPolicy.findUnique({ where: { id: 'site' } }),
    db.contentScreeningPolicyEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ])
  return <>
    <GlobalHeader active="governance" />
    <main className="moderation-shell shell-with-header">
      <Link className="page-breadcrumb" href="/admin/governance">← 网站治理</Link>
      <span className="eyebrow">CONTENT SAFETY</span><h1>内容筛查规则</h1>
      <p>规则只对新提交的动态生效，不追溯历史。命中不会自动封号；未命中如何处理由站主设置。</p>
      <section className="panel governance-panel"><h2>未命中规则时的处理</h2>
        <p>当前：{policy?.autoApproveClearUpdates ? '自动公开' : '人工审核（默认）'}。自动公开的动态仍能被举报和审查。</p>
        {isSiteOwner(admin.id) && <ClearUpdatePolicyForm enabled={policy?.autoApproveClearUpdates ?? false} />}
        {policyEvents.length > 0 && <details><summary>查看处理方式变更记录</summary>{policyEvents.map(event => <p key={event.id}>
          {event.createdAt.toLocaleString('zh-CN')} · {event.actorUserId}：{event.before ? '自动公开' : '人工审核'} → {event.after ? '自动公开' : '人工审核'} · {event.reason}
        </p>)}</details>}
      </section>
      <section className="panel governance-panel"><h2>增加规则</h2><ScreeningRuleForm /></section>
      <section className="panel governance-panel"><h2>已有规则 · {rules.length}</h2>
        {rules.length === 0 && <p>暂未设规则。先从少量高确定性的场景开始，观察误判后再扩展。</p>}
        {rules.map(rule => <details key={rule.id} className="governance-rule-item"><summary>{rule.phrase} · {rule.action === 'BLOCK' ? '暂缓发布' : '人工审核'} · {rule.active ? '生效中' : '已停用'} · V{rule.version}</summary>
          <ScreeningRuleForm key={`${rule.id}:${rule.version}`} rule={rule} /></details>)}
      </section>
      <section className="panel governance-panel"><h2>最近的规则修改记录</h2>
        {events.map(event => <p key={event.id}>
          {event.createdAt.toLocaleString('zh-CN')} · 操作账号 {event.actorUserId} · {event.reason}
          <br />调整前：{event.before ? formatRuleSnapshot(event.before) : '新建规则'}
          <br />调整后：{formatRuleSnapshot(event.after)}
        </p>)}
      </section>
    </main>
  </>
}
