'use client'

import { useActionState, useState } from 'react'

import { submitProjectUpdateAction, type UpdateFormState } from '@/backend/updates/actions'

export function ProjectUpdateForm({ projectId, from, projectFrom, timelineFrom, initialTitle = '', initialBody = '' }: {
  projectId: string; from: 'dashboard' | 'detail' | 'timeline'; projectFrom: 'dashboard' | 'projects'
  timelineFrom: 'dashboard' | 'detail' | 'notifications'; initialTitle?: string; initialBody?: string
}) {
  const [state, action, pending] = useActionState<UpdateFormState, FormData>(submitProjectUpdateAction, {})
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  return (
    <form action={action} className="project-update-form">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="projectFrom" value={projectFrom} />
      <input type="hidden" name="timelineFrom" value={timelineFrom} />
      <label>
        <span>动态标题 *</span>
        <input name="title" value={title} onChange={event => setTitle(event.target.value)} minLength={4} maxLength={80} required placeholder="例如：我们的试玩版终于可以体验了" />
        <small>{title.length} / 80 字</small>
      </label>
      <label>
        <span>这段时间发生了什么？*</span>
        <textarea name="body" value={body} onChange={event => setBody(event.target.value)} minLength={10} maxLength={3000} required rows={9} placeholder="写清楚进展、下一步和大家能做什么；内容审核通过后会出现在项目公开时间线。" />
        <small>{body.length} / 3000 字</small>
      </label>
      {state.error && <p className="inline-error" role="alert">{state.error}</p>}
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? '提交中…' : '提交动态，等待审核'}</button>
    </form>
  )
}
