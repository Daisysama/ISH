'use client'

import { useActionState } from 'react'
import { decideHiddenUpdateAppealAction, submitHiddenUpdateAppealAction, type HiddenAppealState } from '@/backend/governance/hidden-update-appeals'

export function RequestHiddenUpdateAppealForm({ updateId }: { updateId: string }) {
  const [state, action, pending] = useActionState<HiddenAppealState, FormData>(submitHiddenUpdateAppealAction, {})
  return <details className="appeal-correction"><summary>对下架决定向网站提出申诉</summary>
    <form className="governance-mini-form" action={action}>
      <input type="hidden" name="updateId" value={updateId} />
      <label>哪些事实需要重新核对？*<textarea name="statement" minLength={10} maxLength={2000} required rows={3} /></label>
      {state.error && <p className="inline-error" role="alert">{state.error}</p>}
      {state.success && <p className="inline-success" role="status">{state.success}</p>}
      <button className="button button-quiet button-compact" type="submit" disabled={pending}>申请独立网站复核</button>
    </form>
  </details>
}

export function DecideHiddenUpdateAppealForm({ appealId }: { appealId: string }) {
  const [state, action, pending] = useActionState<HiddenAppealState, FormData>(decideHiddenUpdateAppealAction, {})
  return <form className="governance-mini-form" action={action}>
    <input type="hidden" name="appealId" value={appealId} />
    <label>处理结论<select name="decision" defaultValue="UPHELD"><option value="UPHELD">维持下架</option><option value="REOPENED">撤销下架并交独立网站审核</option></select></label>
    <label>核查依据 *<textarea name="reason" minLength={10} maxLength={2000} required rows={3} /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button type="submit" className="button button-quiet button-compact" disabled={pending}>确认处理并留痕</button>
  </form>
}
