'use client'

import { useActionState } from 'react'
import { saveScreeningRuleAction, setClearUpdatePolicyAction, type RuleState } from '@/backend/governance/rules-actions'

export function ClearUpdatePolicyForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState<RuleState, FormData>(setClearUpdatePolicyAction, {})
  return <form action={action} className="governance-mini-form">
    <label>未命中规则的动态<select name="mode" defaultValue={enabled ? 'publish' : 'manual'}>
      <option value="manual">继续人工审核（默认）</option>
      <option value="publish">自动公开（仅站主可开启）</option>
    </select></label>
    <p>自动公开仅表示未命中现有词条，不能证明内容没有问题；公开后仍可举报、下架及申诉。</p>
    <label className="governance-checkbox"><input type="checkbox" name="acknowledgeRisks" />我已核对规则覆盖范围，并理解未命中不代表内容安全（开启自动公开时必选）</label>
    <label>调整原因 *<textarea name="reason" minLength={10} maxLength={1000} required rows={2} /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-quiet button-compact" disabled={pending}>保存处理方式</button>
  </form>
}

export function ScreeningRuleForm({ rule }: { rule?: { id: string; phrase: string; action: 'REVIEW' | 'BLOCK'; active: boolean; version: number } }) {
  const [state, action, pending] = useActionState<RuleState, FormData>(saveScreeningRuleAction, {})
  return (
    <form className="governance-mini-form" action={action}>
      {rule && <input type="hidden" name="ruleId" value={rule.id} />}
      <input type="hidden" name="version" value={rule?.version ?? 0} />
      <label>匹配文字（不支持正则）<input name="phrase" defaultValue={rule?.phrase} minLength={2} maxLength={80} required placeholder="输入需要关注的完整文字" /></label>
      <label>处理方式<select name="action" defaultValue={rule?.action ?? 'REVIEW'}>
        <option value="REVIEW">交人工审核</option><option value="BLOCK">暂缓发布，允许作者申请人工复核</option>
      </select></label>
      {rule && <label className="governance-checkbox"><input type="checkbox" name="active" defaultChecked={rule.active} />启用规则</label>}
      <label>设立或调整依据 *<textarea name="reason" minLength={10} maxLength={500} rows={2} required placeholder="说明适用场景与误判风险" /></label>
      {state.error && <p className="inline-error" role="alert">{state.error}</p>}
      {state.success && <p className="inline-success" role="status">{state.success}</p>}
      <button className="button button-quiet button-compact" type="submit" disabled={pending}>{pending ? '保存中…' : rule ? '保存规则' : '增加规则'}</button>
    </form>
  )
}
