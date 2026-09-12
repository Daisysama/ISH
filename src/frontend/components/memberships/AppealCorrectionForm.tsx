'use client'

import { useActionState } from 'react'

import { reopenPlatformAppealAction, type ReviewActionState } from '@/backend/removal-reviews/actions'

export function AppealCorrectionForm({ reviewId }: { reviewId: string }) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(reopenPlatformAppealAction, {})
  return (
    <details className="appeal-correction">
      <summary>撤销此裁决并重新审查</summary>
      <form action={action} className="review-form">
        <input type="hidden" name="reviewId" value={reviewId} />
        <p>原裁决、审查员及处理依据会作为历史快照保留；重开后由另一位无利益冲突的管理员处理。</p>
        <label>
          <span>撤销原因 *</span>
          <textarea name="reason" rows={3} required minLength={10} maxLength={2000} placeholder="说明发现了什么问题、为什么需要重审（至少 10 字）。" />
        </label>
        {state.error && <p className="inline-error">{state.error}</p>}
        {state.success && <p className="inline-success">{state.success}</p>}
        <button className="button button-quiet button-compact" type="submit" disabled={pending}>
          {pending ? '处理中…' : '确认撤销并留痕'}
        </button>
      </form>
    </details>
  )
}
