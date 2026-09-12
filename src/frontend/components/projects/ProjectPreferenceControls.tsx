'use client'

import { useMemo, useState, useTransition } from 'react'

import {
  clearProjectPreferenceAction,
  hideProjectAction,
  restoreHiddenProjectAction,
  saveProjectPreferenceAction,
  setProjectFavoriteAction,
} from '@/backend/profile/preference-actions'

type Kind = 'INTERESTED' | 'NOT_INTERESTED'

type Props = {
  projectId: string
  projectTags: string[]
  likedTags: string[]
  dislikedTags: string[]
  suppressInterestedPrompt: boolean
  suppressNotInterestedPrompt: boolean
  initialKind?: Kind | null
  initialHidden?: boolean
  initialFavorited?: boolean
}

export function ProjectPreferenceControls(props: Props) {
  const [isPending, startTransition] = useTransition()
  const [openKind, setOpenKind] = useState<Kind | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [suppressFuturePrompt, setSuppressFuturePrompt] = useState(false)
  const [localKind, setLocalKind] = useState<Kind | null>(props.initialKind ?? null)
  const [localHidden, setLocalHidden] = useState(Boolean(props.initialHidden))
  const [localFavorited, setLocalFavorited] = useState(Boolean(props.initialFavorited))
  const [showHideConfirm, setShowHideConfirm] = useState(false)
  const [justHidden, setJustHidden] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const undecidedTags = useMemo(
    () => props.projectTags.filter(tag => !props.likedTags.includes(tag) && !props.dislikedTags.includes(tag)),
    [props.projectTags, props.likedTags, props.dislikedTags],
  )

  function clearPreference() {
    setError(null)
    startTransition(async () => {
      const result = await clearProjectPreferenceAction(props.projectId)
      if (!result.ok) {
        setError(result.error ?? '没有撤销成功，请重试。')
        return
      }
      setLocalKind(null)
      setJustHidden(false)
      setOpenKind(null)
    })
  }

  function persist(kind: Kind, options?: { selected?: string[]; suppress?: boolean; infer?: boolean }) {
    setError(null)
    startTransition(async () => {
      const result = await saveProjectPreferenceAction({
        projectId: props.projectId,
        kind,
        selectedTags: options?.selected ?? [],
        suppressFuturePrompt: options?.suppress ?? false,
        inferFromProject: options?.infer ?? false,
      })
      if (!result.ok) {
        setError(result.error ?? '没有记住这次选择，请重试。')
        return
      }
      setLocalKind(kind)
      setJustHidden(false)
      setOpenKind(null)
      setSelectedTags([])
      setSuppressFuturePrompt(false)
    })
  }

  function begin(kind: Kind) {
    if (localKind === kind) {
      clearPreference()
      return
    }
    const suppressed = kind === 'INTERESTED' ? props.suppressInterestedPrompt : props.suppressNotInterestedPrompt
    if (suppressed || undecidedTags.length === 0) {
      // 关闭追问以后只记住项目层面的选择，不擅自把项目全部标签写进画像。
      persist(kind)
      return
    }
    setSelectedTags([])
    setSuppressFuturePrompt(false)
    setOpenKind(kind)
  }

  function toggle(tag: string) {
    setSelectedTags(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag])
  }

  function hideCurrentProject() {
    setError(null)
    startTransition(async () => {
      const result = await hideProjectAction(props.projectId)
      if (!result.ok) {
        setError(result.error ?? '没有隐藏成功，请重试。')
        return
      }
      setLocalHidden(true)
      setJustHidden(true)
      setShowHideConfirm(false)
    })
  }

  function toggleFavorite() {
    setError(null)
    startTransition(async () => {
      const next = !localFavorited
      const result = await setProjectFavoriteAction(props.projectId, next)
      if (!result.ok) {
        setError(result.error ?? '没有保存收藏，请重试。')
        return
      }
      setLocalFavorited(next)
    })
  }

  function restoreCurrentProject() {
    setError(null)
    startTransition(async () => {
      const result = await restoreHiddenProjectAction(props.projectId)
      if (!result.ok) {
        setError(result.error ?? '没有恢复成功，请重试。')
        return
      }
      setLocalHidden(false)
      setJustHidden(false)
      setShowHideConfirm(false)
    })
  }

  return (
    <div className="project-preference-controls">
      <div className="project-preference-buttons">
        <button className={`preference-button ${localKind === 'INTERESTED' ? 'is-active' : ''}`} type="button" disabled={isPending} onClick={() => begin('INTERESTED')}>♡ {localKind === 'INTERESTED' ? '已感兴趣 · 撤销' : '感兴趣'}</button>
        <button className={`preference-button ${localKind === 'NOT_INTERESTED' ? 'is-active' : ''}`} type="button" disabled={isPending} onClick={() => begin('NOT_INTERESTED')}>× {localKind === 'NOT_INTERESTED' ? '已标记 · 撤销' : '不感兴趣'}</button>
        <button className={`preference-button ${localFavorited ? 'is-active' : ''}`} type="button" disabled={isPending} onClick={toggleFavorite}>{localFavorited ? '★ 已收藏 · 取消' : '☆ 收藏'}</button>
        <button className={`preference-button ${localHidden ? 'is-active' : ''}`} type="button" disabled={isPending} onClick={() => localHidden ? restoreCurrentProject() : setShowHideConfirm(true)}>{localHidden ? '已隐藏 · 恢复' : '隐藏项目'}</button>
      </div>
      {error && <p className="preference-error" role="alert">{error}</p>}
      {justHidden && (
        <div className="preference-undo-bar" role="status">
          <span>这个项目已从您的羊群广场隐藏。</span>
          <button type="button" disabled={isPending} onClick={restoreCurrentProject}>撤销</button>
        </div>
      )}
      {showHideConfirm && !localHidden && (
        <div className="preference-prompt-card preference-hide-confirm" role="dialog" aria-label="隐藏项目确认">
          <strong>先从您的羊群广场隐藏这个项目？</strong>
          <p>隐藏只影响您的发现体验，之后可以随时恢复。</p>
          <div className="preference-prompt-actions">
            <button type="button" className="button button-quiet button-compact" disabled={isPending} onClick={() => setShowHideConfirm(false)}>取消</button>
            <button type="button" className="button button-primary button-compact" disabled={isPending} onClick={hideCurrentProject}>先隐藏</button>
          </div>
        </div>
      )}
      {openKind && (
        <div className="preference-prompt-card" role="dialog" aria-label={openKind === 'INTERESTED' ? '具体喜欢哪些元素' : '具体不喜欢哪些元素'}>
          <strong>{openKind === 'INTERESTED' ? '想让我们以后多找点类似的吗？' : '为了以后少遇到不合胃口的咩，愿意告诉我们是哪一点吗？'}</strong>
          <p>{openKind === 'INTERESTED' ? '选具体喜欢的元素，也可以直接跳过。' : '选具体不喜欢的元素；“不感兴趣”本身不会让项目立刻消失。'}</p>
          <div className="tag-row preference-choice-tags">{undecidedTags.map(tag => <button key={tag} type="button" className={`tag-chip ${selectedTags.includes(tag) ? 'is-selected' : ''}`} onClick={() => toggle(tag)}>{tag}</button>)}</div>
          <label className="preference-never-ask"><input type="checkbox" checked={suppressFuturePrompt} onChange={event => setSuppressFuturePrompt(event.target.checked)} /><span>以后点“{openKind === 'INTERESTED' ? '感兴趣' : '不感兴趣'}”时不再弹出这个问题</span></label>
          <div className="preference-prompt-actions">
            <button type="button" className="button button-quiet button-compact" disabled={isPending} onClick={() => persist(openKind, { suppress: suppressFuturePrompt })}>跳过</button>
            <button type="button" className="button button-primary button-compact" disabled={isPending} onClick={() => persist(openKind, { selected: selectedTags, suppress: suppressFuturePrompt })}>{selectedTags.length ? '记住这些' : '就这样'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
