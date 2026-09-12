'use client'

import { useState, useTransition } from 'react'

import { decideProjectResponseAction } from '@/backend/responses/actions'

type Props = {
  responseId: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'
}

export function ResponseDecisionCard({ responseId, status: initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function decide(decision: 'APPROVED' | 'REJECTED') {
    setError(null)
    startTransition(async () => {
      const result = await decideProjectResponseAction(responseId, decision)
      if (!result.ok) {
        setError(result.error ?? '这次没有处理成功，请重试。')
        return
      }
      setStatus(decision)
    })
  }

  if (status !== 'PENDING') return <span className={`response-status response-status-${status.toLowerCase()}`}>{status === 'APPROVED' ? '已接受' : status === 'REJECTED' ? '已婉拒' : '已撤回'}</span>

  return (
    <div className="response-decision-actions">
      <button className="button button-quiet button-compact" type="button" disabled={isPending} onClick={() => decide('REJECTED')}>婉拒</button>
      <button className="button button-primary button-compact" type="button" disabled={isPending} onClick={() => decide('APPROVED')}>接受同行</button>
      {error && <p className="preference-error" role="alert">{error}</p>}
    </div>
  )
}
