'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import {
  createProjectAction,
  type ProjectFormState,
} from '@/app/actions/projects'
import { CATEGORIES, MODES, NEED_SUGGESTIONS } from '@/lib/projects'

/**
 * 发愿表单。
 *
 * 右边那张预览卡不是装饰：填表的人看到的应该是「别人会看到什么」，
 * 而不是一堆输入框。所以标题、正文、标签一边打字一边同步过去。
 *
 * 真正决定能不能存的是 server action 里的校验，这里的 required / maxLength
 * 只负责让人填的时候有即时反馈。
 */
export function ProjectForm({ ownerName }: { ownerName: string }) {
  const [state, action, isPending] = useActionState<ProjectFormState, FormData>(
    createProjectAction,
    {},
  )

  // 这些 state 是给预览卡和字数统计用的，不是提交用的 ——
  // 提交走的仍然是原生表单，值从 DOM 里读。所以就算 JS 出错、
  // 预览卡不动了，表单本身照样能提交。
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [mode, setMode] = useState<string>(MODES[0].value)
  const [needs, setNeeds] = useState<string[]>([])
  const [draftNeed, setDraftNeed] = useState('')

  /** 点一下加上，再点一下去掉 —— 快捷标签和已选列表用的是同一个函数。 */
  function toggleNeed(need: string) {
    setNeeds((prev) =>
      prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need],
    )
  }

  function addDraftNeed() {
    // 截断和去重在这里做一次，服务端还会再做一次 ——
    // 这一次是为了让人立刻看到结果，那一次才是说了算的。
    const value = draftNeed.trim().slice(0, 12)
    if (value && !needs.includes(value)) setNeeds([...needs, value])
    setDraftNeed('')
  }

  return (
    <div className="compose">
      <form action={action} className="compose-form">
        {state.error && (
          <div className="form-error" role="alert">
            {state.error}
          </div>
        )}

        <div className="field">
          <label htmlFor="title">一句话说清你要做什么</label>
          <input
            id="title"
            name="title"
            className="input-lg"
            required
            maxLength={60}
            placeholder="例如：做一个给独立音乐人用的巡演排期工具"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={state.field === 'title'}
          />
          <span className="hint">{title.length} / 60</span>
        </div>

        <div className="field">
          <label htmlFor="summary">展开讲讲</label>
          <textarea
            id="summary"
            name="summary"
            rows={7}
            required
            maxLength={2000}
            placeholder="为什么想做这件事？现在做到哪一步了？做到什么程度算成？&#10;&#10;写得具体一点 —— 愿意同行的人是看着这段文字决定要不要来的。"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            aria-invalid={state.field === 'summary'}
          />
          <span className="hint">{summary.length} / 2000，至少 30 字</span>
        </div>

        <div className="field">
          <label>领域</label>
          <div className="chips">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip${category === c ? ' is-on' : ''}`}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
              >
                {c}
              </button>
            ))}
          </div>
          <input type="hidden" name="category" value={category} />
        </div>

        <div className="field">
          <label>投入预期</label>
          <div className="modes">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                className={`mode-card${mode === m.value ? ' is-on' : ''}`}
                onClick={() => setMode(m.value)}
                aria-pressed={mode === m.value}
              >
                <span className="mode-label">{m.label}</span>
                <span className="mode-hint">{m.hint}</span>
              </button>
            ))}
          </div>
          <input type="hidden" name="mode" value={mode} />
          <span className="hint">
            写明白这一条，别人才知道该不该来 —— 让人自己猜，最后一定对不上。
          </span>
        </div>

        <div className="field">
          <label htmlFor="need-input">需要什么样的同行者</label>
          <div className="chips">
            {NEED_SUGGESTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className={`chip${needs.includes(n) ? ' is-on' : ''}`}
                onClick={() => toggleNeed(n)}
                aria-pressed={needs.includes(n)}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="need-add">
            <input
              id="need-input"
              value={draftNeed}
              maxLength={12}
              placeholder="没有合适的？自己写一个"
              onChange={(e) => setDraftNeed(e.target.value)}
              onKeyDown={(e) => {
                // 在表单里按回车默认会提交，这里拦下来当作「添加标签」。
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addDraftNeed()
                }
              }}
            />
            <button type="button" className="btn btn-ghost" onClick={addDraftNeed}>
              添加
            </button>
          </div>

          {needs.length > 0 && (
            <div className="chips chips-picked">
              {needs.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="chip is-on chip-removable"
                  onClick={() => toggleNeed(n)}
                  title="点一下移除"
                >
                  {n} <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}

          {/* 选中的标签用隐藏字段提交，服务端用 getAll('needs') 取。 */}
          {needs.map((n) => (
            <input key={n} type="hidden" name="needs" value={n} />
          ))}
        </div>

        <div className="compose-actions">
          <Link href="/dashboard" className="btn btn-ghost">
            取消
          </Link>
          <button className="btn btn-glow" type="submit" disabled={isPending}>
            {isPending ? '正在立起来…' : '发愿'}
          </button>
        </div>
      </form>

      <aside className="compose-preview">
        <div className="preview-label">别人会看到的样子</div>

        <article className="project-card is-preview">
          <div className="project-card-top">
            <span className={`tag tag-${mode}`}>
              {MODES.find((m) => m.value === mode)?.label}
            </span>
            <span className="tag">{category}</span>
          </div>

          <h3 className={title ? '' : 'is-placeholder'}>
            {title || '还没有标题'}
          </h3>

          <p className={summary ? '' : 'is-placeholder'}>
            {summary || '还没有正文。这里会显示你写的介绍。'}
          </p>

          {needs.length > 0 && (
            <div className="project-needs">
              {needs.map((n) => (
                <span key={n} className="need">
                  {n}
                </span>
              ))}
            </div>
          )}

          <footer className="project-card-foot">
            <span className="avatar avatar-sm">{ownerName.slice(0, 1)}</span>
            <span>{ownerName} 发起</span>
          </footer>
        </article>
      </aside>
    </div>
  )
}
