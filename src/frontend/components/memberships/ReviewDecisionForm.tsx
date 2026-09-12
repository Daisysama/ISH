'use client'

import { useActionState } from 'react'

import {
  decideRemovalReviewAction, restoreRemovedMemberAction, type ReviewActionState,
} from '@/backend/removal-reviews/actions'

export function ReviewDecisionForm({
  reviewId, recipient,
}: {
  reviewId: string
  recipient: 'FOUNDER' | 'PLATFORM'
}) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(decideRemovalReviewAction, {})
  return (
    <form action={action} className="review-form">
      <input type="hidden" name="reviewId" value={reviewId} />
      <label>
        <span>处理结果</span>
        <select name="decision" defaultValue="" required>
          <option value="" disabled>请选择</option>
          {recipient === 'FOUNDER' ? (
            <>
              <option value="RESTORED">确认误操作，恢复同行</option>
              <option value="DECLINED">维持移出，说明理由</option>
            </>
          ) : (
            <>
              <option value="NO_VIOLATION">未发现平台违规</option>
              <option value="RECORD_CORRECTION">原理由不准确，追加官方纠正说明</option>
              <option value="MISCONDUCT">认定治理行为不当，待进一步处置</option>
            </>
          )}
        </select>
      </label>
      <label><span>处理依据 *</span><textarea name="reason" rows={4} required minLength={10} maxLength={2000} placeholder="请写清事实、依据与后续安排，不覆盖原始移出记录。" /></label>
      {state.error && <p className="inline-error">{state.error}</p>}
      {state.success && <p className="inline-success">{state.success}</p>}
      <button type="submit" className="button button-primary button-compact" disabled={pending}>{pending ? '处理中…' : '确认并留痕'}</button>
    </form>
  )
}

export function RestoreRemovedMemberForm({
  membershipId,
}: {
  membershipId: string
}) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(restoreRemovedMemberAction, {})
  return (
    <form action={action} className="review-form">
      <input type="hidden" name="membershipId" value={membershipId} />
      <label><span>恢复说明 *</span><textarea name="reason" rows={2} required minLength={10} maxLength={2000} placeholder="例如：核实后确认误点，现恢复同行。" /></label>
      {state.error && <p className="inline-error">{state.error}</p>}
      {state.success && <p className="inline-success">{state.success}</p>}
      <button type="submit" className="button button-quiet button-compact" disabled={pending}>{pending ? '处理中…' : '恢复同行'}</button>
    </form>
  )
}
