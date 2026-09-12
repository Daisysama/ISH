'use client'

import { useActionState } from 'react'
import { changeUserBlockAction, type UserBlockState } from '@/backend/blocks/actions'

export function UserBlockForm({ targetUserId, active }: { targetUserId: string; active: boolean }) {
  const [state, action, pending] = useActionState<UserBlockState, FormData>(changeUserBlockAction, {})
  return <form action={action} className="inline-action-form">
    <input type="hidden" name="targetUserId" value={targetUserId} />
    <input type="hidden" name="operation" value={active ? 'UNBLOCK' : 'BLOCK'} />
    <button className="button button-quiet button-compact" type="submit" disabled={pending}>{pending ? '处理中…' : active ? '解除拉黑' : '不再看此人的动态'}</button>
    {state.error && <span className="inline-error" role="alert">{state.error}</span>}
    {state.success && <span className="inline-success" role="status">{state.success}</span>}
  </form>
}
