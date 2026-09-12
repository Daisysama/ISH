'use client'

import { useActionState } from 'react'
import { submitUpdateReportAction, type ReportState } from '@/backend/governance/report-actions'

export function UpdateReportForm({ projectId, updateId }: { projectId: string; updateId: string }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(submitUpdateReportAction, {})
  return <form className="governance-mini-form" action={action}>
    <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="updateId" value={updateId} />
    <label>主要问题<select name="reason" defaultValue="OTHER">
      <option value="HARASSMENT">骚扰、人身攻击或歧视</option><option value="MISLEADING">虚假或误导性信息</option>
      <option value="RIGHTS">贡献、作品或收益权益争议</option><option value="OTHER">其他</option>
    </select></label>
    <label>请说明发生了什么 *<textarea name="statement" minLength={10} maxLength={2000} required rows={6} placeholder="指出具体内容和希望核查的事实。不要贴密码或其他敏感信息。" /></label>
    <p>举报内容仅给无利益冲突的网站审查员查看，不交给被举报动态的作者或项目发起人裁决。</p>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-primary button-compact" type="submit" disabled={pending}>{pending ? '提交中…' : '提交给网站审查'}</button>
  </form>
}
