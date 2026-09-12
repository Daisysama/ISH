'use client'

import { useActionState } from 'react'

import { decideProjectUpdateAction, type UpdateFormState } from '@/backend/updates/actions'

export function ProjectUpdateReviewForm({ updateId }: { updateId: string }) {
  const [approveState, approveAction, approving] = useActionState<UpdateFormState, FormData>(decideProjectUpdateAction, {})
  const [rejectState, rejectAction, rejecting] = useActionState<UpdateFormState, FormData>(decideProjectUpdateAction, {})
  return (
    <div className="update-review-actions">
      <form action={approveAction} className="review-form">
        <input type="hidden" name="updateId" value={updateId} />
        <input type="hidden" name="decision" value="APPROVED" />
        <label><span>通过备注（可选）</span><textarea name="reason" rows={2} maxLength={500} placeholder="简短写明审查依据；会留在审核日志中。" /></label>
        {approveState.error && <p className="inline-error">{approveState.error}</p>}
        {approveState.success && <p className="inline-success">{approveState.success}</p>}
        <button className="button button-primary button-compact" disabled={approving || rejecting}>审核通过并发布</button>
      </form>
      <form action={rejectAction} className="review-form">
        <input type="hidden" name="updateId" value={updateId} />
        <input type="hidden" name="decision" value="REJECTED" />
        <label><span>退回原因 *</span><textarea name="reason" rows={2} minLength={10} maxLength={500} required placeholder="明确告诉作者哪里需要修改，至少 10 字。" /></label>
        {rejectState.error && <p className="inline-error">{rejectState.error}</p>}
        {rejectState.success && <p className="inline-success">{rejectState.success}</p>}
        <button className="button button-quiet button-compact" disabled={rejecting || approving}>退回并留痕</button>
      </form>
    </div>
  )
}
