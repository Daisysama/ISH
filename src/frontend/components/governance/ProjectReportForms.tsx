'use client'

import { useActionState } from 'react'
import { submitProjectReportAction, decideProjectReportAction, type ProjectReportState } from '@/backend/governance/project-reports'
import { appealProjectUnlistingAction, decideProjectUnlistingAppealAction,
  restoreProjectByOwnerAction } from '@/backend/governance/project-report-appeals'
import { PROJECT_REPORT_CATEGORIES } from '@/shared/governance-labels'

export function SubmitProjectReportForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<ProjectReportState, FormData>(submitProjectReportAction, {})
  return <form action={action} className="governance-mini-form"><input type="hidden" name="projectId" value={projectId} />
    <label>问题类型<select name="category" defaultValue="" required><option value="" disabled>请选择</option>
      {Object.entries(PROJECT_REPORT_CATEGORIES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
    </select></label>
    <label>说明情况 *<textarea name="statement" minLength={10} maxLength={2000} rows={5} required placeholder="请说明您看到的问题，并指出需要核查的事实；请不要粘贴密码或他人隐私。" /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-primary button-compact" disabled={pending}>向网站举报项目</button>
  </form>
}

export function DecideProjectReportForm({ reportId, versionChanged }: { reportId: string; versionChanged: boolean }) {
  const [state, action, pending] = useActionState<ProjectReportState, FormData>(decideProjectReportAction, {})
  return <form action={action} className="governance-mini-form"><input type="hidden" name="reportId" value={reportId} />
    <label>核查结论<select name="decision"><option value="NO_VIOLATION">未发现需要下架的问题</option><option value="UNLISTED">暂时下架项目</option></select></label>
    {versionChanged && <label className="governance-checkbox"><input name="acknowledgeVersionChange" type="checkbox" />我已对照项目当前版本，确认原问题仍适用于现在的项目（下架时必选）</label>}
    <label>处理依据 *<textarea name="reason" minLength={10} maxLength={2000} rows={3} required /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-primary button-compact" disabled={pending}>记录结论并通知当事人</button>
  </form>
}

export function AppealProjectReportForm({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState<ProjectReportState, FormData>(appealProjectUnlistingAction, {})
  return <form action={action} className="governance-mini-form"><input type="hidden" name="reportId" value={reportId} />
    <label>申诉说明 *<textarea name="statement" minLength={10} maxLength={2000} rows={3} required placeholder="请说明需要纠正的事实、授权情况或其他证据。" /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-quiet button-compact" disabled={pending}>向独立网站管理员申诉</button>
  </form>
}

export function DecideProjectReportAppealForm({ appealId }: { appealId: string }) {
  const [state, action, pending] = useActionState<ProjectReportState, FormData>(decideProjectUnlistingAppealAction, {})
  return <form action={action} className="governance-mini-form"><input type="hidden" name="appealId" value={appealId} />
    <label>独立复核结论<select name="decision"><option value="UPHELD">维持下架</option><option value="RESTORED">撤销下架并恢复公开</option></select></label>
    <label>复核依据 *<textarea name="reason" minLength={10} maxLength={2000} rows={3} required /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-primary button-compact" disabled={pending}>记录复核决定</button>
  </form>
}

export function OwnerRestoreProjectForm({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState<ProjectReportState, FormData>(restoreProjectByOwnerAction, {})
  return <details className="appeal-correction"><summary>站主撤销管理员的下架</summary>
    <form action={action} className="governance-mini-form"><input type="hidden" name="reportId" value={reportId} />
      <label>纠错理由 *<textarea name="reason" minLength={10} maxLength={2000} rows={3} required /></label>
      {state.error && <p className="inline-error" role="alert">{state.error}</p>}
      {state.success && <p className="inline-success" role="status">{state.success}</p>}
      <button className="button button-quiet button-compact" disabled={pending}>撤销下架并保留原始记录</button>
    </form>
  </details>
}
