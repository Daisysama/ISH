'use client'

import { useActionState } from 'react'

import { reopenProjectUpdateAction, type UpdateFormState } from '@/backend/updates/actions'

/** 站主纠正管理员的动态裁决；原裁决不删除，由独立审核员重新处理。 */
export function ProjectUpdateCorrectionForm({ updateId }: { updateId: string }) {
  const [state, action, pending] = useActionState<UpdateFormState, FormData>(reopenProjectUpdateAction, {})
  return (
    <details className="appeal-correction update-review-record">
      <summary>撤销管理员裁决并重新审核</summary>
      <form action={action} className="review-form">
        <input type="hidden" name="updateId" value={updateId} />
        <p>原审核人、结论和处理理由继续保留。已公开的动态会立即从公开时间线撤下，重新审核后才能发布。</p>
        <label><span>撤销原因 *</span>
          <textarea name="reason" rows={3} minLength={10} maxLength={2000} required placeholder="写明撤销的依据与下一位审核员应当关注的问题，至少 10 字。" />
        </label>
        {state.error && <p className="inline-error" role="alert">{state.error}</p>}
        {state.success && <p className="inline-success" role="status">{state.success}</p>}
        <button className="button button-quiet button-compact" type="submit" disabled={pending}>
          {pending ? '撤销中…' : '确认撤销并留痕'}
        </button>
      </form>
    </details>
  )
}
