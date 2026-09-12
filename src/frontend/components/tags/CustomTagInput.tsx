'use client'

import { KeyboardEvent, useMemo, useState } from 'react'

type CustomTagInputProps = {
  id: string
  name: string
  defaultTags?: string[]
  maxTags: number
  maxLength: number
  placeholder: string
  hint?: string
}

function normalize(raw: string) {
  return raw.trim().replace(/^#+/, '')
}

export function CustomTagInput({
  id,
  name,
  defaultTags = [],
  maxTags,
  maxLength,
  placeholder,
  hint,
}: CustomTagInputProps) {
  const [tags, setTags] = useState(() => [...new Set(defaultTags.map(normalize).filter(Boolean))].slice(0, maxTags))
  const [draft, setDraft] = useState('')

  const hiddenValue = useMemo(() => tags.join(','), [tags])

  function addDraft(raw = draft) {
    const pieces = raw.split(/[,，、;；\n]+/).map(normalize).filter(Boolean)
    if (pieces.length === 0) return

    setTags((current) => {
      const next = [...current]
      for (const piece of pieces) {
        if (piece.length > maxLength) continue
        if (!next.includes(piece) && next.length < maxTags) next.push(piece)
      }
      return next
    })
    setDraft('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
      event.preventDefault()
      addDraft()
    }

    if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      setTags((current) => current.slice(0, -1))
    }
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((value) => value !== tag))
  }

  return (
    <div className="custom-tag-control">
      <input name={name} type="hidden" value={hiddenValue} />
      {tags.length > 0 && (
        <div className="custom-tag-list" aria-label="已经添加的自定义标签">
          {tags.map((tag) => (
            <button className="custom-tag-chip" key={tag} type="button" onClick={() => removeTag(tag)} title="点击移除">
              {tag}<span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
      <input
        id={id}
        type="text"
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => {
          const value = event.target.value
          if (/[,，、;；\n]/.test(value)) {
            addDraft(value)
          } else {
            setDraft(value)
          }
        }}
        onBlur={() => addDraft()}
        onKeyDown={onKeyDown}
      />
      <span className="hint">{hint ?? `输入后按回车或逗号生成标签，最多 ${maxTags} 个。`}</span>
    </div>
  )
}
