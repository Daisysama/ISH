import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/backend/auth/current-user'
import { getSiteAccess } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { classifyUserRecord } from '@/core/governance/user-record'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { GOVERNANCE_EVENT_LABELS, SANCTION_SCOPE_LABELS } from '@/shared/governance-labels'
import { USER_REPORT_CATEGORY_LABELS } from '@/shared/user-report'

export const metadata = { title: '用户治理记录 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const viewer = await getCurrentUser()
  if (!viewer || (await getSiteAccess(viewer.id)).role === 'USER') notFound()
  const query = ((await searchParams).q ?? '').trim().slice(0, 254)
  const searchedUid = /^[1-9]\d{0,9}$/.test(query) && Number(query) <= 2147483647 ? Number(query) : null
  const users = await db.user.findMany({ where: query ? { OR: [
    { uid: searchedUid ?? -1 }, { id: query }, { email: query.toLowerCase() }, { displayName: { contains: query, mode: 'insensitive' } },
  ] } : {}, orderBy: { createdAt: 'desc' }, take: 50,
  select: { id: true, uid: true, displayName: true, email: true, createdAt: true,
    receivedSanctions: { orderBy: { createdAt: 'desc' }, select: { scope: true, status: true, expiresAt: true } },
  } })
  const userIds = users.map(user => user.id)
  const [projectFindings, updateFindings, removalFindings, commentFindings] = userIds.length ? await Promise.all([
    db.projectReport.findMany({ where: { decision: 'UNLISTED', mergedIntoId: null, project: {
      creatorId: { in: userIds }, status: 'HIDDEN',
    } }, select: { projectId: true, project: { select: { creatorId: true } } } }),
    db.projectUpdateReport.findMany({ where: { decision: 'CONTENT_REMOVED', update: {
      authorId: { in: userIds }, status: 'HIDDEN',
    } }, select: { updateId: true, update: { select: { authorId: true } } } }),
    db.projectRemovalReview.findMany({ where: { recipient: 'PLATFORM', status: 'RESOLVED', decision: 'MISCONDUCT',
      removal: { removedByUserIdSnapshot: { in: userIds } },
    }, select: { removalId: true, removal: { select: { removedByUserIdSnapshot: true } } } }),
    db.projectComment.findMany({ where: { authorId: { in: userIds }, status: 'HIDDEN', hiddenById: { not: null } },
      select: { id: true, authorId: true } }),
  ]) : [[], [], [], []]
  const findings = new Map<string, Set<string>>()
  for (const report of projectFindings) {
    if (!findings.has(report.project.creatorId)) findings.set(report.project.creatorId, new Set())
    findings.get(report.project.creatorId)?.add(`project:${report.projectId}`)
  }
  for (const report of updateFindings) if (report.update.authorId) {
    if (!findings.has(report.update.authorId)) findings.set(report.update.authorId, new Set())
    findings.get(report.update.authorId)?.add(`update:${report.updateId}`)
  }
  for (const review of removalFindings) {
    const actorId = review.removal.removedByUserIdSnapshot
    if (!findings.has(actorId)) findings.set(actorId, new Set())
    findings.get(actorId)?.add(`removal:${review.removalId}`)
  }
  for (const comment of commentFindings) {
    if (!findings.has(comment.authorId)) findings.set(comment.authorId, new Set())
    findings.get(comment.authorId)?.add(`comment:${comment.id}`)
  }
  const exact = users.find(user => user.uid === searchedUid || user.id === query || user.email === query.toLowerCase())
  const details = exact ? await Promise.all([
    db.userSanction.findMany({ where: { targetId: exact.id }, orderBy: { createdAt: 'desc' },
      include: { issuedBy: { select: { displayName: true } }, appeal: true,
        events: { orderBy: { createdAt: 'asc' } } },
    }),
    db.projectReport.findMany({ where: { project: { creatorId: exact.id }, status: 'RESOLVED' },
      orderBy: { reviewedAt: 'desc' }, select: { id: true, titleSnapshot: true, decision: true, decisionReason: true,
        reviewedAt: true, appeal: { select: { decision: true, decisionReason: true } } },
    }),
    db.projectUpdateReport.findMany({ where: { update: { authorId: exact.id }, status: 'RESOLVED' },
      orderBy: { reviewedAt: 'desc' }, select: { id: true, titleSnapshot: true, decision: true,
        decisionReason: true, reviewedAt: true },
    }),
    db.projectRemovalReview.findMany({ where: { recipient: 'PLATFORM', removal: { removedByUserIdSnapshot: exact.id } },
      orderBy: { createdAt: 'desc' }, select: { id: true, status: true, decision: true, decisionReason: true,
        decidedAt: true, removal: { select: { project: { select: { title: true } }, reasonSnapshot: true } } },
    }),
    db.projectComment.findMany({ where: { authorId: exact.id, OR: [
      { hiddenById: { not: null } }, { reports: { some: { status: 'RESOLVED' } } },
      { events: { some: { action: 'SCREENED_HIDDEN' } } },
    ] }, orderBy: { createdAt: 'desc' }, select: { id: true, body: true, status: true, hiddenReason: true,
      project: { select: { title: true } }, appeal: { select: { decision: true, decisionReason: true } },
      reports: { where: { status: 'RESOLVED' }, select: { decision: true, decisionReason: true } },
      events: { where: { action: { in: ['SCREENED_HIDDEN', 'HIDDEN_AFTER_REPORT', 'RESTORED_AFTER_APPEAL', 'OWNER_RESTORED'] } },
        orderBy: { createdAt: 'asc' }, select: { action: true, note: true, createdAt: true } },
    } }),
    db.userReport.findMany({ where: { targetId: exact.id }, orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, category: true, statement: true, status: true, decision: true, decisionReason: true,
        reporterId: true, reviewedById: true, createdAt: true, events: { orderBy: { createdAt: 'asc' },
          select: { action: true, actorUserId: true, createdAt: true, note: true } } },
    }),
  ]) : null
  return <><GlobalHeader active="governance" /><main className="moderation-shell shell-with-header">
    <Link className="page-breadcrumb" href="/admin/governance">← 网站治理</Link>
    <span className="eyebrow">USER GOVERNANCE</span><h1>用户治理记录</h1>
    <p>以稳定 UID 区分账号，内部 UUID 继续用于旧记录与授权。颜色只依据已作出的有效处分；未经核实的举报与已撤销的处分不会标记为违规。</p>
    <section className="panel governance-panel" aria-label="治理状态颜色示例">
      <h2>颜色怎么看</h2><p>颜色只是管理界面的提示，具体案件请看原始依据、处理时间和撤销记录。</p>
      <div className="user-record-legend">
        <p><span className="user-record-status user-record-regular">浅绿 · 暂无有效处分</span> 没有当前有效处分，也没有已确认的内容处置。</p>
        <p><span className="user-record-status user-record-history">暖黄 · 一次已确认</span> 曾有一次正式处置，例如一条违规评论经审查下架。</p>
        <p><span className="user-record-status user-record-repeated">暖橙 · 多次已确认</span> 有两次或更多正式处置；未核实的举报不计数。</p>
        <p><span className="user-record-status user-record-restricted">浅红 · 当前受限</span> 账号正在禁言或限制发布等，具体权限与期限以处分记录为准。</p>
        <p><span className="user-record-status user-record-site">暗莓红 · 全站停用</span> 当前存在最高等级的全站限制；站主仍可依据证据纠正。</p>
      </div>
    </section>
    <form method="get" className="staff-search"><label>查找 UID、邮箱或名称
      <input name="q" defaultValue={query} placeholder="输入短 UID、邮箱或名称，旧 UUID 仍可用" /></label>
      <button className="button button-quiet button-compact">查找</button>
    </form>
    <section className="panel governance-panel"><h2>{query ? '查找结果' : '最近注册的用户'} · {users.length}</h2>
      {users.length === 0 && <p>没有找到用户。请检查 UID、邮箱或名称。</p>}
      {users.map(user => { const state = classifyUserRecord(user.receivedSanctions, new Date(), findings.get(user.id)?.size ?? 0); return <p className="user-record-row" key={user.id}>
        <span className={`user-record-status user-record-${state.tone}`}>{state.label}</span>
        <Link href={`/admin/users?q=${user.uid}`} className="story-link">{user.displayName}</Link>
        <span>UID：{user.uid}</span><small>{user.email}</small>
      </p> })}
    </section>
    {exact && details && <section className="panel governance-panel"><h2>{exact.displayName} 的治理档案</h2>
      <p>UID：{exact.uid} · 注册：{exact.createdAt.toLocaleString('zh-CN')}</p>
      <h3>网站账号处分（含撤销记录）</h3>
      {details[0].length === 0 && <p>暂无账号处分记录。</p>}
      {details[0].map(item => <article key={item.id} className="governance-rule-item">
        <strong>{SANCTION_SCOPE_LABELS[item.scope]} · {item.status === 'REVOKED' ? '已撤销' : item.expiresAt && item.expiresAt <= new Date() ? '已到期' : '执行中'}</strong>
        <p>由 {item.issuedBy.displayName} 于 {item.createdAt.toLocaleString('zh-CN')} 作出。原因：{item.reason}</p>
        {item.revokeReason && <p>撤销原因：{item.revokeReason}</p>}
        {item.appeal && <p>当事人申诉：{item.appeal.statement} · {item.appeal.status === 'PENDING' ? '待独立审查' : item.appeal.decisionReason ?? '已处理'}</p>}
        <details><summary>逐条操作历史</summary>{item.events.map(event => <p key={event.id}>{event.createdAt.toLocaleString('zh-CN')} · 操作用户 ID：{event.actorUserId} · {GOVERNANCE_EVENT_LABELS[event.action] ?? '其他操作'} · {event.reason}</p>)}</details>
      </article>)}
      <h3>项目举报审查结论</h3>{details[1].length === 0 && <p>没有已审结的项目举报。</p>}
      {details[1].map(item => <p key={item.id}>{item.reviewedAt?.toLocaleString('zh-CN')} · {item.titleSnapshot}：{item.decision === 'UNLISTED' ? '原决定下架' : '核查后未下架'} · {item.decisionReason}
        {item.appeal?.decision === 'RESTORED' && ' · 后经独立申诉恢复公开'}</p>)}
      <h3>项目动态举报审查结论</h3>{details[2].length === 0 && <p>没有已审结的动态举报。</p>}
      {details[2].map(item => <p key={item.id}>{item.reviewedAt?.toLocaleString('zh-CN')} · {item.titleSnapshot}：{item.decision === 'CONTENT_REMOVED' ? '原决定下架' : '核查后未下架'} · {item.decisionReason}</p>)}
      <h3>同行移出平台复核</h3>{details[3].length === 0 && <p>没有相关的平台复核记录。</p>}
      {details[3].map(item => <p key={item.id}>{item.decidedAt?.toLocaleString('zh-CN') ?? '等待处理'} · 项目「{item.removal.project.title}」：{item.status === 'PENDING' ? '待核查，不计入处置' : item.decision === 'MISCONDUCT' ? '确认存在不当移出' : item.decision === 'NO_VIOLATION' ? '未发现违规' : item.decision === 'RECORD_CORRECTION' ? '移出记录已纠正' : item.decision === 'RESTORED' ? '恢复同行' : '申诉未获支持'} · 原移出理由：{item.removal.reasonSnapshot} · 平台结论：{item.decisionReason ?? '待独立审查'}</p>)}
      <h3>评论与回复核查记录</h3>{details[4].length === 0 && <p>没有已处理的评论核查。</p>}
      {details[4].map(item => <article key={item.id} className="governance-rule-item">
        <strong>项目「{item.project.title}」 · {item.status === 'HIDDEN' ? '目前下架' : item.appeal?.decision === 'REOPENED' ? '经申诉恢复公开' : '当前不计入已确认处置'}</strong>
        <p>评论原文：{item.body}</p>{item.hiddenReason && <p>网站下架依据：{item.hiddenReason}</p>}
        {item.reports.map((report, index) => <p key={index}>原举报结论：{report.decision === 'HIDDEN' ? '下架' : report.decision === 'AUTHOR_REMOVED' ? '作者自行删除，未认定违规' : '维持公开'} · {report.decisionReason}</p>)}
        {item.appeal?.decisionReason && <p>独立申诉：{item.appeal.decision === 'REOPENED' ? '恢复公开' : '维持原决定'} · {item.appeal.decisionReason}</p>}
        {item.events.map((event, index) => <p key={index}>{event.createdAt.toLocaleString('zh-CN')} · {{ SCREENED_HIDDEN: '筛查后下架', HIDDEN_AFTER_REPORT: '经举报审查下架', RESTORED_AFTER_APPEAL: '申诉后恢复', OWNER_RESTORED: '站主纠错恢复' }[event.action as 'SCREENED_HIDDEN'] ?? '其他'} · {event.note}</p>)}
      </article>)}
      <h3>针对账号的举报与独立核查</h3><p>待审与撤回举报仅为线索，不计入用户的已确认处置。</p>
      {details[5].length === 0 && <p>没有账号举报。</p>}
      {details[5].map(item => <article key={item.id} className="governance-rule-item">
        <strong>{item.status === 'PENDING' ? '待查线索' : item.status === 'WITHDRAWN' ? '举报已撤回' : item.decision === 'NO_VIOLATION' ? '审查后未认定违规' : '审查后转单独处分流程'}</strong>
        <p>{item.createdAt.toLocaleString('zh-CN')} · 类别：{USER_REPORT_CATEGORY_LABELS[item.category] ?? '其他'} · 举报人 ID：{item.reporterId}</p>
        <p className="update-body">陈述：{item.statement}</p>
        {item.decisionReason && <p>审核人 ID：{item.reviewedById} · 依据：{item.decisionReason}</p>}
        <details><summary>案件操作历史</summary>{item.events.map((event, index) => <p key={index}>{event.createdAt.toLocaleString('zh-CN')} · 操作用户 ID：{event.actorUserId} · {event.action} · {event.note}</p>)}</details>
      </article>)}
    </section>}
  </main></>
}
