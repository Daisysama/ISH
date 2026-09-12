'use client'

import { useActionState } from 'react'

import { removeProjectMemberAction, type MembershipLifecycleActionState } from '@/backend/memberships/actions'

export function RemoveMemberForm({ membershipId, displayName }: { membershipId: string; displayName: string }) {
  const [state, action, pending] = useActionState<MembershipLifecycleActionState, FormData>(
    removeProjectMemberAction,
    {},
  )

  return (
    <form action={action} className="team-remove-form">
      <input type="hidden" name="membershipId" value={membershipId} />
      <div>
        <strong>移出 {displayName}</strong>
        <p>这不是删除历史。确认后，对方会立即失去项目成员权限与申请制群聊访问权。</p>
      </div>
      <label>
        <span>移除理由 *</span>
        <textarea
          name="reason"
          minLength={5}
          maxLength={500}
          rows={3}
          required
          placeholder="请写清楚原因。完整理由只进入项目内部活动，不自动公开到羊群广场。"
        />
      </label>
      {state.error && <p className="inline-error">{state.error}</p>}
      {state.success && <p className="inline-success">{state.success}</p>}
      <button className="button button-danger button-compact" type="submit" disabled={pending}>
        {pending ? '处理中…' : '确认移出同行者'}
      </button>
    </form>
  )
}
