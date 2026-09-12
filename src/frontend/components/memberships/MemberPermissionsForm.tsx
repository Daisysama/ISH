'use client'

import { useActionState } from 'react'

import { setMemberPermissionsAction, type MemberPermissionState } from '@/backend/memberships/permission-actions'
import { MEMBER_PERMISSION_OPTIONS } from '@/core/memberships/permissions'

export function MemberPermissionsForm({ membershipId, currentPermissions }: {
  membershipId: string
  currentPermissions: string[]
}) {
  const [state, action, pending] = useActionState<MemberPermissionState, FormData>(setMemberPermissionsAction, {})
  return (
    <form action={action} className="member-permission-form">
      <input type="hidden" name="membershipId" value={membershipId} />
      <h4>成员权限</h4>
      <p>只有勾选的权限生效。收回后，尚在审核的动态也不能再通过；已公开的贡献仍留在时间线。</p>
      {MEMBER_PERMISSION_OPTIONS.map(option => (
        <label className="member-permission-option" key={option.value}>
          <input type="checkbox" name="permissions" value={option.value} defaultChecked={currentPermissions.includes(option.value)} />
          <span><strong>{option.label}</strong><small>{option.description}</small></span>
        </label>
      ))}
      <label className="member-permission-reason">调整原因 *
        <textarea name="reason" minLength={10} maxLength={500} required rows={2} placeholder="说明为什么授予或收回，便于协作和交接。" />
      </label>
      {state.error && <p className="inline-error">{state.error}</p>}
      {state.success && <p className="inline-success">{state.success}</p>}
      <button className="button button-quiet button-compact" type="submit" disabled={pending}>{pending ? '保存中…' : '保存成员权限'}</button>
    </form>
  )
}
