'use client'

import { useActionState } from 'react'

import { submitRemovalReviewAction, type ReviewActionState } from '@/backend/removal-reviews/actions'

export function RemovalReviewForm({
  removalId, recipient,
}: {
  removalId: string
  recipient: 'FOUNDER' | 'PLATFORM'
}) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(submitRemovalReviewAction, {})
  return (
    <form action={action} className="review-form">
      <input type="hidden" name="removalId" value={removalId} />
      <input type="hidden" name="recipient" value={recipient} />
      <label>
        <span>主要问题（可选）</span>
        <select name="category" defaultValue="">
          <option value="">暂不分类，直接说明</option>
          <option value="MISTAKE">可能是误操作</option>
          <option value="FACT_DISPUTE">移出理由与事实不符</option>
          <option value="RETALIATION">疑似恶意或报复性移出</option>
          <option value="CONTRIBUTION">涉及作品、贡献或收益</option>
          <option value="OTHER">其他</option>
        </select>
      </label>
      <label>
        <span>说明情况 *（10～2000 字）</span>
        <textarea name="statement" required minLength={10} maxLength={2000} rows={5} placeholder="请描述发生了什么，以及希望核查的事实；不要粘贴账号密码或无关隐私。" />
      </label>
      {state.error && <p className="inline-error">{state.error}</p>}
      {state.success && <p className="inline-success">{state.success}</p>}
      <button className="button button-primary button-compact" type="submit" disabled={pending}>
        {pending ? '提交中…' : recipient === 'PLATFORM' ? '向网站管理员申诉' : '向发起人申请核查'}
      </button>
    </form>
  )
}
