'use client'

import { useActionState } from 'react'

import {
  approveProjectRevisionAction,
  rejectProjectRevisionAction,
} from '@/backend/moderation/actions'
import type { ModerationFormState } from '@/shared/project'

export function RevisionModerationPanel({ revisionId }: { revisionId: string }) {
  const [approveState, approveAction, approving] = useActionState<ModerationFormState, FormData>(
    approveProjectRevisionAction,
    {},
  )
  const [rejectState, rejectAction, rejecting] = useActionState<ModerationFormState, FormData>(
    rejectProjectRevisionAction,
    {},
  )

  return (
    <div className="moderation-actions">
      <form action={approveAction} className="moderation-form">
        <input type="hidden" name="revisionId" value={revisionId} />
        <label htmlFor={`approve-revision-note-${revisionId}`}>通过备注（可选）</label>
        <textarea
          id={`approve-revision-note-${revisionId}`}
          name="note"
          rows={2}
          maxLength={500}
          placeholder="例如：修改清晰，可以替换线上版本。"
        />
        {approveState.error && <p className="inline-error">{approveState.error}</p>}
        {approveState.success && <p className="inline-success">{approveState.success}</p>}
        <button className="button button-primary button-full" type="submit" disabled={approving || rejecting}>
          {approving ? '切换中…' : '通过并上线新版'}
        </button>
      </form>

      <form action={rejectAction} className="moderation-form moderation-reject">
        <input type="hidden" name="revisionId" value={revisionId} />
        <label htmlFor={`reject-revision-reason-${revisionId}`}>退回原因</label>
        <textarea
          id={`reject-revision-reason-${revisionId}`}
          name="reason"
          rows={3}
          minLength={5}
          maxLength={500}
          required
          placeholder="明确指出这版修改哪里需要调整。"
        />
        {rejectState.error && <p className="inline-error">{rejectState.error}</p>}
        {rejectState.success && <p className="inline-success">{rejectState.success}</p>}
        <button className="button button-danger button-full" type="submit" disabled={approving || rejecting}>
          {rejecting ? '处理中…' : '退回这版修改'}
        </button>
      </form>
    </div>
  )
}
