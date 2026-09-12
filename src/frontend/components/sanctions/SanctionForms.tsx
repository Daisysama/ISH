'use client'

import { useActionState } from 'react'
import { appealUserSanctionAction, decideSanctionAppealAction, issueUserSanctionAction,
  revokeUserSanctionAction, type SanctionState } from '@/backend/sanctions/actions'
import { SANCTION_SCOPE_LABELS } from '@/shared/governance-labels'

export function IssueSanctionForm({ owner }: { owner: boolean }) {
  const [state, action, pending] = useActionState<SanctionState, FormData>(issueUserSanctionAction, {})
  return <form action={action} className="governance-mini-form">
    <label>目标账号注册邮箱 *<input name="email" type="email" required placeholder="someone@example.com" /></label>
    <label>限制范围<select name="scope" defaultValue="PROJECTS">
      <option value="COMMENTS">{SANCTION_SCOPE_LABELS.COMMENTS}</option>
      <option value="PROJECTS">{SANCTION_SCOPE_LABELS.PROJECTS}</option>
      <option value="RESPONSES">{SANCTION_SCOPE_LABELS.RESPONSES}</option>
      {owner && <option value="SITE">{SANCTION_SCOPE_LABELS.SITE}（仅站主，永久）</option>}
    </select></label>
    <label>限制天数（1～365 天；站主填 0 表示永久）<input name="durationDays" type="number" min={owner ? 0 : 1} max={365} defaultValue={1} required /></label>
    <p>评论功能上线前，评论限制只会记入记录，正式接入评论后才阻止评论和回复。全站停用期间本人仍可看处分、消息并申诉。</p>
    <label>具体依据 *<textarea name="reason" minLength={10} maxLength={2000} required rows={4} placeholder="写明事实、涉及的内容和处分依据；具体处罚细则会另行制定。" /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-quiet button-compact" type="submit" disabled={pending}>确认处分并通知本人</button>
  </form>
}

export function AppealSanctionForm({ sanctionId }: { sanctionId: string }) {
  const [state, action, pending] = useActionState<SanctionState, FormData>(appealUserSanctionAction, {})
  return <form action={action} className="governance-mini-form"><input type="hidden" name="sanctionId" value={sanctionId} />
    <label>申诉说明 *<textarea name="statement" minLength={10} maxLength={2000} required rows={4} placeholder="写明哪些事实需要重新核对，不要贴密码或其他敏感信息。" /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-primary button-compact" type="submit" disabled={pending}>交给独立网站管理员复核</button>
  </form>
}

export function DecideSanctionAppealForm({ appealId }: { appealId: string }) {
  const [state, action, pending] = useActionState<SanctionState, FormData>(decideSanctionAppealAction, {})
  return <form action={action} className="governance-mini-form"><input type="hidden" name="appealId" value={appealId} />
    <label>处理结论<select name="decision" defaultValue="UPHELD"><option value="UPHELD">维持原处分</option><option value="REVOKED">撤销原处分</option></select></label>
    <label>独立审查依据 *<textarea name="reason" minLength={10} maxLength={2000} required rows={3} /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-primary button-compact" type="submit" disabled={pending}>确认并通知本人</button>
  </form>
}

export function RevokeSanctionForm({ sanctionId }: { sanctionId: string }) {
  const [state, action, pending] = useActionState<SanctionState, FormData>(revokeUserSanctionAction, {})
  return <details className="appeal-correction"><summary>站主撤销此处分</summary>
    <form action={action} className="governance-mini-form"><input type="hidden" name="sanctionId" value={sanctionId} />
      <p>原始决定、处分人与全部申诉记录仍保留。</p>
      <label>撤销原因 *<textarea name="reason" minLength={10} maxLength={2000} rows={3} required /></label>
      {state.error && <p className="inline-error" role="alert">{state.error}</p>}
      {state.success && <p className="inline-success" role="status">{state.success}</p>}
      <button className="button button-quiet button-compact" type="submit" disabled={pending}>确认撤销并留痕</button>
    </form>
  </details>
}
