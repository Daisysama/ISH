'use client'

import { useActionState } from 'react'
import { decideUpdateReportAction, type ReportState } from '@/backend/governance/report-actions'

export function UpdateReportDecisionForm({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(decideUpdateReportAction, {})
  return <form className="governance-mini-form" action={action}>
    <input type="hidden" name="reportId" value={reportId} />
    <label>核查结论<select name="decision" defaultValue="NO_VIOLATION">
      <option value="NO_VIOLATION">未发现需要下架的问题</option>
      <option value="CONTENT_REMOVED">暂时下架动态，保留历史与纠错机会</option>
    </select></label>
    <label>处理依据 *<textarea name="reason" minLength={10} maxLength={2000} required rows={3} placeholder="请说明事实、依据和后续安排，至少 10 字。" /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-quiet button-compact" disabled={pending} type="submit">{pending ? '处理中…' : '确认处理并留痕'}</button>
  </form>
}
