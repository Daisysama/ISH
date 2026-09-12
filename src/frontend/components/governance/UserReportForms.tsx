'use client'

import { useActionState } from 'react'
import { decideUserReportAction, submitUserReportAction, withdrawUserReportAction, type UserReportState } from '@/backend/user-reports/actions'

export function SubmitUserReportForm({ targetId }: { targetId: string }) {
  const [state, action, pending] = useActionState<UserReportState, FormData>(submitUserReportAction, {})
  return <form action={action} className="governance-mini-form">
    <input type="hidden" name="targetId" value={targetId} />
    <label>问题类别<select name="category" defaultValue="" required>
      <option value="" disabled>请选择</option><option value="HARASSMENT">骚扰或辱骂</option>
      <option value="IMPERSONATION">冒用身份</option><option value="RIGHTS">作品或权益问题</option>
      <option value="FRAUD">虚假或欺诈行为</option><option value="OTHER">其他</option>
    </select></label>
    <label>事实说明 *<textarea name="statement" minLength={10} maxLength={2000} rows={5} required
      placeholder="请写清楚您亲眼看到的行为、发生位置或关联项目；不要公开他人隐私。" /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-primary button-compact" disabled={pending}>提交网站独立核查</button>
  </form>
}

export function WithdrawUserReportForm({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState<UserReportState, FormData>(withdrawUserReportAction, {})
  return <form action={action} className="inline-action-form"><input type="hidden" name="reportId" value={reportId} />
    <button className="button button-quiet button-compact" disabled={pending}>撤回举报</button>
    {state.error && <span className="inline-error" role="alert">{state.error}</span>}
    {state.success && <span className="inline-success" role="status">{state.success}</span>}
  </form>
}

export function DecideUserReportForm({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState<UserReportState, FormData>(decideUserReportAction, {})
  return <form action={action} className="governance-mini-form"><input type="hidden" name="reportId" value={reportId} />
    <label>独立审查结果<select name="decision" defaultValue="" required>
      <option value="" disabled>请选择</option><option value="NO_VIOLATION">暂未认定违规</option>
      <option value="REFER_TO_SANCTIONS">记录问题并转单独处分流程</option>
    </select></label>
    <label>处理依据 *<textarea name="reason" minLength={10} maxLength={2000} rows={3} required
      placeholder="陈述查核事实；这里不会自动禁言或封禁。" /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-primary button-compact" disabled={pending}>确认并留痕</button>
  </form>
}
