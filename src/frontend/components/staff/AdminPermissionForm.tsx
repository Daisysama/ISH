'use client'

import { useActionState } from 'react'

import { setSiteAdminAction, type StaffActionState } from '@/backend/staff/actions'
import { SITE_PERMISSION_OPTIONS } from '@/core/governance/permissions'

export function AdminPermissionForm({
  email, displayName, currentPermissions = [], active = false,
}: { email: string; displayName: string; currentPermissions?: string[]; active?: boolean }) {
  const [state, action, pending] = useActionState<StaffActionState, FormData>(setSiteAdminAction, {})
  return (
    <form action={action} className="staff-permissions-form">
      <input type="hidden" name="email" value={email} />
      <p><strong>{displayName}</strong> · {email} {active ? '· 当前管理员' : '· 尚未授权'}</p>
      <div className="staff-permission-list">
        {SITE_PERMISSION_OPTIONS.map(option => (
          <label key={option.value}>
            <input type="checkbox" name="permissions" value={option.value} defaultChecked={currentPermissions.includes(option.value)} />
            <span><strong>{option.label}</strong><small>{option.description}</small></span>
          </label>
        ))}
      </div>
      <label className="staff-reason">授权/撤销原因（必填，10～500 字）
        <textarea name="reason" required minLength={10} maxLength={500} rows={2} placeholder="说明为什么将这些权限交给此人，便于后续交接和审计。" />
      </label>
      {state.error && <p className="inline-error">{state.error}</p>}
      {state.success && <p className="inline-success">{state.success}</p>}
      <div className="staff-form-actions">
        <button className="button button-primary button-compact" type="submit" name="operation" value="GRANT" disabled={pending}>{pending ? '处理中…' : '保存权限'}</button>
        {active && <button className="button button-quiet button-compact" type="submit" name="operation" value="REVOKE" disabled={pending}>撤销管理员</button>}
      </div>
    </form>
  )
}
