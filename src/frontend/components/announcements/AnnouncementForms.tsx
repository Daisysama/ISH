'use client'

import { useActionState } from 'react'
import { changeAnnouncementStatusAction, createAnnouncementAction, deleteAnnouncementAction, editAnnouncementDraftAction, restoreDeletedAnnouncementAction, toggleAnnouncementPinAction, type AnnouncementState } from '@/backend/announcements/actions'

export function CreateAnnouncementForm() {
  const [state, action, pending] = useActionState<AnnouncementState, FormData>(createAnnouncementAction, {})
  return <form action={action} className="governance-mini-form">
    <label>公告标题 *<input name="title" minLength={4} maxLength={100} required placeholder="请用一句话说明这则公告" /></label>
    <label>公告内容 *<textarea name="body" rows={7} minLength={20} maxLength={5000} required placeholder="说明具体变化、生效时间以及用户可以做什么。" /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button type="submit" className="button button-primary button-compact" disabled={pending}>保存公告草稿</button>
  </form>
}

export function EditAnnouncementDraftForm({ announcementId, title, body, published }: { announcementId: string; title: string; body: string; published: boolean }) {
  const [state, action, pending] = useActionState<AnnouncementState, FormData>(editAnnouncementDraftAction, {})
  return <form action={action} className="governance-mini-form">
    <input type="hidden" name="announcementId" value={announcementId} />
    <label>标题<input name="title" minLength={4} maxLength={100} defaultValue={title} required /></label>
    <label>正文<textarea name="body" minLength={20} maxLength={5000} rows={6} defaultValue={body} required /></label>
    {published && <label>修改原因（仅管理端留档） *<textarea name="reason" minLength={10} maxLength={1000} rows={2} required /></label>}
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-quiet button-compact" disabled={pending}>{published ? '确认修改并保留旧版本' : '保存新草稿版本'}</button>
  </form>
}

export function DeleteAnnouncementForm({ announcementId }: { announcementId: string }) {
  const [state, action, pending] = useActionState<AnnouncementState, FormData>(deleteAnnouncementAction, {})
  return <form action={action} className="inline-action-form">
    <input type="hidden" name="announcementId" value={announcementId} />
    <button type="submit" className="button button-quiet button-compact" disabled={pending}>{pending ? '删除中…' : '删除'}</button>
    {state.error && <span className="inline-error" role="alert">{state.error}</span>}
  </form>
}

export function RestoreAnnouncementForm({ announcementId }: { announcementId: string }) {
  const [state, action, pending] = useActionState<AnnouncementState, FormData>(restoreDeletedAnnouncementAction, {})
  return <form action={action} className="inline-action-form">
    <input type="hidden" name="announcementId" value={announcementId} />
    <button type="submit" className="button button-quiet button-compact" disabled={pending}>{pending ? '恢复中…' : '站主恢复公告'}</button>
    {state.error && <span className="inline-error" role="alert">{state.error}</span>}
    {state.success && <span className="inline-success" role="status">{state.success}</span>}
  </form>
}

export function AnnouncementStatusForm({ announcementId, operation, allowNotifyAll, label }: {
  announcementId: string; operation: 'PUBLISH' | 'WITHDRAW'; allowNotifyAll: boolean; label?: string
}) {
  const [state, action, pending] = useActionState<AnnouncementState, FormData>(changeAnnouncementStatusAction, {})
  const content = <form action={action} className="governance-mini-form">
    <input type="hidden" name="announcementId" value={announcementId} /><input type="hidden" name="action" value={operation} />
    <label>{operation === 'PUBLISH' ? '发布说明' : '撤回说明'}（仅管理端留档） *<textarea name="reason" minLength={10} maxLength={1000} rows={2} required placeholder="简述发布或撤回的原因，用户只看到公告正文。" /></label>
    {allowNotifyAll && operation === 'PUBLISH' && <label className="governance-checkbox"><input name="notifyEveryone" type="checkbox" />同时向现有用户发送一次站内提醒（仅站主）</label>}
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button type="submit" className="button button-quiet button-compact" disabled={pending}>
      {pending ? '处理中…' : operation === 'PUBLISH' ? '确认发布' : '确认撤回'}
    </button>
  </form>
  return label ? <details className="appeal-correction"><summary>{label}</summary>{content}</details> : content
}

export function PinAnnouncementForm({ announcementId, pinned }: { announcementId: string; pinned: boolean }) {
  const [state, action, pending] = useActionState<AnnouncementState, FormData>(toggleAnnouncementPinAction, {})
  return <form action={action} className="inline-action-form">
    <input type="hidden" name="announcementId" value={announcementId} />
    <button className="button button-quiet button-compact" disabled={pending}>{pinned ? '取消置顶' : '置顶'}</button>
    {state.error && <span className="inline-error" role="alert">{state.error}</span>}
    {state.success && <span className="inline-success" role="status">{state.success}</span>}
  </form>
}
