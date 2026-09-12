'use client'

import { useActionState } from 'react'
import { decideCommentReportAction, decideScreenedCommentAction, type CommentGovernanceState } from '@/backend/comments/governance'
import { decideCommentAppealAction, ownerRestoreCommentAction } from '@/backend/comments/appeals'

function Decision({ id, type }: { id: string; type: 'screen' | 'report' | 'appeal' }) {
  const handler = type === 'screen' ? decideScreenedCommentAction : type === 'report' ? decideCommentReportAction : decideCommentAppealAction
  const [state, action, pending] = useActionState<CommentGovernanceState, FormData>(handler, {})
  return <form action={action} className="governance-mini-form">
    <input type="hidden" name={type === 'screen' ? 'commentId' : type === 'report' ? 'reportId' : 'appealId'} value={id} />
    <label>核查结果<select name="decision" required defaultValue="">
      <option value="" disabled>请选择</option>
      {type === 'screen' ? <><option value="VISIBLE">放行公开</option><option value="HIDDEN">暂缓公开，允许作者申诉</option></>
        : type === 'report' ? <><option value="NO_VIOLATION">核查后维持公开</option><option value="HIDDEN">下架评论，允许作者申诉</option></>
          : <><option value="UPHELD">维持原下架</option><option value="REOPENED">撤销原下架并恢复公开</option></>}
    </select></label>
    <label>处理依据 *<textarea name="reason" minLength={10} maxLength={2000} rows={3} required /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-primary button-compact" disabled={pending}>留痕并通知相关人员</button>
  </form>
}

export function ScreenedCommentDecision({ id }: { id: string }) { return <Decision id={id} type="screen" /> }
export function CommentReportDecision({ id }: { id: string }) { return <Decision id={id} type="report" /> }
export function CommentAppealDecision({ id }: { id: string }) { return <Decision id={id} type="appeal" /> }

export function OwnerCommentCorrection({ commentId }: { commentId: string }) {
  const [state, action, pending] = useActionState<CommentGovernanceState, FormData>(ownerRestoreCommentAction, {})
  return <details className="comment-inline-details"><summary>站主纠正管理员的下架</summary><form action={action} className="governance-mini-form">
    <input type="hidden" name="commentId" value={commentId} />
    <label>纠错依据 *<textarea name="reason" minLength={10} maxLength={2000} rows={3} required /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-quiet button-compact" disabled={pending}>恢复公开并保留原处理记录</button>
  </form></details>
}
