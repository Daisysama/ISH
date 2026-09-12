'use client'

import { useActionState } from 'react'
import { requestProjectUpdateReviewAction, type UpdateFormState } from '@/backend/updates/actions'

export function AutomaticReviewRequestForm({ updateId }: { updateId: string }) {
  const [state, action, pending] = useActionState<UpdateFormState, FormData>(requestProjectUpdateReviewAction, {})
  return <form action={action} className="inline-action-form">
    <input type="hidden" name="updateId" value={updateId} />
    <button type="submit" className="button button-quiet button-compact" disabled={pending}>{pending ? '提交中…' : '申请网站管理员人工复核'}</button>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
  </form>
}
