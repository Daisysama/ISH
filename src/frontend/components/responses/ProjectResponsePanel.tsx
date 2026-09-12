'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

import { submitProjectResponseAction, withdrawProjectResponseAction } from '@/backend/responses/actions'
import { PROJECT_RESPONSE_LIMITS } from '@/core/responses/project-response'
import { PROJECT_RESPONSE_STATUS_LABELS, type ProjectResponseStatusValue } from '@/shared/project-response'

type ExistingResponse = {
  id: string
  roles: string[]
  message: string | null
  status: ProjectResponseStatusValue
} | null

type Props = {
  projectId: string
  options: string[]
  loggedIn: boolean
  existingResponse: ExistingResponse
  approvalGroupUnlocked: boolean
}

export function ProjectResponsePanel({ projectId, options, loggedIn, existingResponse, approvalGroupUnlocked }: Props) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(existingResponse?.roles ?? [])
  const [message, setMessage] = useState(existingResponse?.message ?? '')
  const [localResponse, setLocalResponse] = useState(existingResponse)
  const [error, setError] = useState<string | null>(null)

  function toggle(role: string) {
    setSelected(current => current.includes(role) ? current.filter(item => item !== role) : [...current, role])
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await submitProjectResponseAction({ projectId, roles: selected, message })
      if (!result.ok) {
        setError(result.error ?? '这声咩没有送出去，请重试。')
        return
      }
      const responseId = 'responseId' in result ? result.responseId : undefined
      setLocalResponse({ id: responseId ?? localResponse?.id ?? '', roles: selected, message: message || null, status: 'PENDING' })
      setOpen(false)
    })
  }

  function withdraw() {
    if (!localResponse?.id) {
      window.location.reload()
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await withdrawProjectResponseAction(localResponse.id)
      if (!result.ok) {
        setError(result.error ?? '没有撤回成功，请重试。')
        return
      }
      setLocalResponse({ ...localResponse, status: 'WITHDRAWN' })
    })
  }

  if (!loggedIn) {
    return (
      <section className="project-response-card">
        <div>
          <span className="eyebrow">REPLY WITH A MEOW</span>
          <h2>觉得自己能帮上忙？</h2>
          <p>登录后回一声“咩”，让创作者知道您愿意同行。</p>
        </div>
        <Link className="button button-primary" href={`/login?next=/projects/${projectId}`}>咩！我想响应 →</Link>
      </section>
    )
  }

  if (localResponse?.status === 'PENDING') {
    return (
      <section className="project-response-card project-response-card-status">
        <div><span className="eyebrow">咩已经送到</span><h2>等待创作者回应。</h2><p>创作者可查看您当前填写的介绍、能力、喜好、经历与作品链接，以及公开项目的同行履历。</p></div>
        <button className="button button-quiet" type="button" disabled={isPending} onClick={withdraw}>撤回这声咩</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    )
  }

  if (localResponse?.status === 'APPROVED') {
    return (
      <section className="project-response-card project-response-card-approved">
        <div><span className="eyebrow">已经同行</span><h2>您已经成为这个项目的同行者。</h2><p>{approvalGroupUnlocked ? '申请制群聊已经在下方为您解锁。项目资料当前仍是只读，后续编辑权限由发起人主动授予。' : '项目资料当前仍是只读，后续编辑权限由发起人主动授予。'}</p></div>
      </section>
    )
  }

  const canRetry = localResponse?.status === 'REJECTED' || localResponse?.status === 'WITHDRAWN'

  return (
    <section className="project-response-card">
      <div className="project-response-heading">
        <div>
          <span className="eyebrow">REPLY WITH A MEOW</span>
          <h2>{canRetry ? '还想再回一声咩吗？' : '觉得自己能帮上忙？'}</h2>
          <p>{canRetry ? `上一次状态：${PROJECT_RESPONSE_STATUS_LABELS[localResponse!.status]}。如果情况变了，可以重新响应。` : '“感兴趣”只是私人偏好；这声咩会真的送到创作者面前。'}</p>
        </div>
        <button className="button button-primary" type="button" onClick={() => setOpen(value => !value)}>{open ? '先收起来' : '咩！我想响应 →'}</button>
      </div>

      {open && (
        <div className="project-response-form">
          <div>
            <strong>您想怎么同行？</strong>
            <p>选择最贴近的方式即可，可以多选。</p>
            <div className="tag-row response-role-options">
              {options.map(option => <button key={option} className={`tag-chip ${selected.includes(option) ? 'is-selected' : ''}`} type="button" onClick={() => toggle(option)}>{option}</button>)}
            </div>
          </div>
          <label className="field">
            <span>想对创作者说一句什么？</span>
            <textarea value={message} minLength={PROJECT_RESPONSE_LIMITS.messageMin} maxLength={PROJECT_RESPONSE_LIMITS.messageMax} onChange={event => setMessage(event.target.value)} placeholder="一句话就够。比如：您好，我主要做角色原画，这个项目的方向我很喜欢，想聊聊。" />
            <small>至少 {PROJECT_RESPONSE_LIMITS.messageMin} 个字。认真回一声咩，也是在尊重创作者。</small>
          </label>
          <div className="response-self-report-note">
            提交后，该项目发起人可查看您当前填写的个人介绍、能力、明确选择的喜好与不喜欢的方向、经历、作品链接及公开项目中的同行履历；接受后，当前团队成员也可在同行者页查看。即使您未打开公开画像也一样。撤回或被婉拒后，申请页不再展示这些非公开资料；这些内容均属用户自述，未经 ISH 认证。
            <Link className="story-link" href="/profile">完善我的画像 →</Link>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="project-response-actions">
            <button className="button button-quiet" type="button" onClick={() => setOpen(false)}>取消</button>
            <button className="button button-primary" type="button" disabled={isPending || selected.length === 0 || message.trim().length < PROJECT_RESPONSE_LIMITS.messageMin} onClick={submit}>{isPending ? '正在送出…' : '发出这声咩'}</button>
          </div>
        </div>
      )}
    </section>
  )
}
