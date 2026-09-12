'use client'

import { useActionState } from 'react'

import {
  approveProjectAction,
  rejectProjectAction,
} from '@/backend/moderation/actions'
import type { ModerationFormState } from '@/shared/project'

export function ModerationPanel({ projectId }: { projectId: string }) {
  const [approveState, approveAction, approving] = useActionState<
    ModerationFormState,
    FormData
  >(approveProjectAction, {})
  const [rejectState, rejectAction, rejecting] = useActionState<
    ModerationFormState,
    FormData
  >(rejectProjectAction, {})

  return (
    <div className="moderation-actions">
      <form action={approveAction} className="moderation-form">
        <input type="hidden" name="projectId" value={projectId} />
        <label htmlFor={`approve-note-${projectId}`}>通过备注（可选）</label>
        <textarea
          id={`approve-note-${projectId}`}
          name="note"
          rows={2}
          maxLength={500}
          placeholder="例如：信息完整，允许公开。"
        />
        {approveState.error && <p className="inline-error">{approveState.error}</p>}
        {approveState.success && <p className="inline-success">{approveState.success}</p>}
        <button className="button button-primary button-full" type="submit" disabled={approving || rejecting}>
          {approving ? '发布中…' : '审核通过并发布'}
        </button>
      </form>

      <form action={rejectAction} className="moderation-form moderation-reject">
        <input type="hidden" name="projectId" value={projectId} />
        <label htmlFor={`reject-reason-${projectId}`}>退回原因</label>
        <textarea
          id={`reject-reason-${projectId}`}
          name="reason"
          rows={3}
          minLength={5}
          maxLength={500}
          required
          placeholder="明确告诉创作者哪里需要补充或修改。"
        />
        {rejectState.error && <p className="inline-error">{rejectState.error}</p>}
        {rejectState.success && <p className="inline-success">{rejectState.success}</p>}
        <button
          className="button button-danger button-full"
          type="submit"
          disabled={approving || rejecting}
        >
          {rejecting ? '处理中…' : '退回修改'}
        </button>
      </form>
    </div>
  )
}
