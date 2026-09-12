import { db } from '@/backend/database/client'
import { SITE_PERMISSION_OPTIONS } from '@/core/governance/permissions'

const labels = new Map<string, string>(SITE_PERMISSION_OPTIONS.map(item => [item.value, item.label]))

/** 授权历史与管理员列表同页；读权限由承载页面检查。 */
export async function AuthorizationLog() {
  const events = await db.siteGovernanceEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  const users = await db.user.findMany({ where: { id: { in: [...new Set(events.flatMap(event => [event.actorUserId, event.targetUserId]))] } },
    select: { id: true, displayName: true } })
  const names = new Map(users.map(user => [user.id, user.displayName]))
  return <section className="panel staff-panel" id="authorization-log"><h2>授权与撤销记录</h2>
    <p>最近 100 条；操作人和目标同时展示名称及稳定用户 ID。</p>
    {events.length === 0 && <p>目前还没有授权历史。</p>}
    {events.map(event => <article key={event.id} className="governance-rule-item">
      <strong>{event.action === 'ADMIN_REVOKED' ? '撤销管理员' : event.action === 'ADMIN_GRANTED' ? '授予管理员' :
        event.action === 'ADMIN_SUSPENDED_ON_SANCTION' ? '因账号处分暂停管理员权限' : '调整权限'}</strong>
      <p>目标：{names.get(event.targetUserId) ?? '已注销用户'} · 用户 ID：{event.targetUserId}</p>
      <p>操作人：{names.get(event.actorUserId) ?? '已注销用户'} · 用户 ID：{event.actorUserId} · {event.createdAt.toLocaleString('zh-CN')}</p>
      <p>之前：{event.beforePermissions.map(value => labels.get(value) ?? value).join('、') || '无'} →
        之后：{event.afterPermissions.map(value => labels.get(value) ?? value).join('、') || '无'}</p>
      <p>原因：{event.reason}</p>
    </article>)}
  </section>
}
