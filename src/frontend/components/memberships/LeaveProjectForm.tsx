'use client'

import { useActionState } from 'react'

import { leaveProjectAction, type MembershipLifecycleActionState } from '@/backend/memberships/actions'

export function LeaveProjectForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<MembershipLifecycleActionState, FormData>(
    leaveProjectAction,
    {},
  )

  return (
    <form action={action} className="leave-project-card">
      <input type="hidden" name="projectId" value={projectId} />
      <div>
        <span className="eyebrow">LEAVE PROJECT</span>
        <h2>退出项目</h2>
        <p>如果决定离开，请给同行者留一句说明。退出后，项目成员权限与申请制群聊访问会立即失效。</p>
      </div>
      <label>
        <span>退出原因 *</span>
        <textarea
          name="reason"
          minLength={5}
          maxLength={500}
          rows={4}
          required
          placeholder="例如：近期时间安排发生变化，无法继续稳定参与。"
        />
      </label>
      {state.error && <p className="inline-error">{state.error}</p>}
      {state.success && <p className="inline-success">{state.success}</p>}
      <button className="button button-danger button-compact" type="submit" disabled={pending}>
        {pending ? '处理中…' : '退出这个项目'}
      </button>
    </form>
  )
}
