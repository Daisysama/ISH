'use client'

import { useActionState } from 'react'

import { createProjectAction } from '@/backend/projects/actions'
import { PROJECT_LIMITS } from '@/core/meow/project'
import type { ProjectFormState } from '@/shared/project'

export function MeowForm() {
  const [state, action, isPending] = useActionState<ProjectFormState, FormData>(
    createProjectAction,
    {},
  )

  return (
    <form action={action} className="project-form">
      {state.error && (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      )}

      <div className="field">
        <label htmlFor="title">项目标题</label>
        <input
          id="title"
          name="title"
          type="text"
          required
          minLength={2}
          maxLength={PROJECT_LIMITS.titleMax}
          aria-invalid={state.field === 'title'}
          placeholder="例如：一款关于深夜电台的短篇视觉小说"
        />
      </div>

      <div className="field">
        <label htmlFor="summary">一句话介绍</label>
        <textarea
          id="summary"
          name="summary"
          required
          minLength={10}
          maxLength={PROJECT_LIMITS.summaryMax}
          aria-invalid={state.field === 'summary'}
          placeholder="让第一次看到它的人立刻知道你想做什么。"
          rows={3}
        />
        <span className="hint">最多 {PROJECT_LIMITS.summaryMax} 个字。</span>
      </div>

      <div className="field">
        <label htmlFor="description">项目说明</label>
        <textarea
          id="description"
          name="description"
          required
          minLength={30}
          maxLength={PROJECT_LIMITS.descriptionMax}
          aria-invalid={state.field === 'description'}
          placeholder="讲清楚目标、现在做到哪一步、希望找到什么样的同行者。"
          rows={12}
        />
        <span className="hint">
          先写清楚，不必写成商业计划书。提交后会进入人工审核，不会立即公开。
        </span>
      </div>

      <button className="btn" type="submit" disabled={isPending}>
        {isPending ? '正在发出…' : '发出这一声咩'}
      </button>
    </form>
  )
}
