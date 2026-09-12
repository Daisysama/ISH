'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { PROJECT_TAG_GROUPS } from '@/core/meow/project'
import { PROJECT_PURPOSE_LABELS, PROJECT_STAGE_LABELS } from '@/shared/project'

type SortMode = 'recommended' | 'published' | 'interested' | 'favorites'
type SortDirection = 'desc' | 'asc'
type MenuKey = 'stage' | 'purpose' | 'type' | 'sort' | 'direction' | null

type DiscoveryFilterProps = {
  selectedStages: string[]
  selectedPurposes: string[]
  selectedTypes: string[]
  sort: SortMode
  direction: SortDirection
  showRecommended: boolean
}

const SORT_LABELS: Record<SortMode, string> = {
  recommended: '猜您喜欢',
  published: '发布时间',
  interested: '感兴趣最多',
  favorites: '收藏最多',
}

function countLabel(label: string, count: number) {
  return count > 0 ? `${label} ${count}` : label
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export function DiscoveryFilter({
  selectedStages,
  selectedPurposes,
  selectedTypes,
  sort,
  direction,
  showRecommended,
}: DiscoveryFilterProps) {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const [openMenu, setOpenMenu] = useState<MenuKey>(null)
  const [stages, setStages] = useState(selectedStages)
  const [purposes, setPurposes] = useState(selectedPurposes)
  const [types, setTypes] = useState(selectedTypes)
  const [sortMode, setSortMode] = useState<SortMode>(sort)
  const [sortDirection, setSortDirection] = useState<SortDirection>(direction)

  const availableSorts = useMemo<SortMode[]>(
    () => showRecommended
      ? ['recommended', 'published', 'interested', 'favorites']
      : ['published', 'interested', 'favorites'],
    [showRecommended],
  )

  useEffect(() => {
    setStages(selectedStages)
    setPurposes(selectedPurposes)
    setTypes(selectedTypes)
    setSortMode(sort)
    setSortDirection(direction)
  }, [selectedStages, selectedPurposes, selectedTypes, sort, direction])

  useEffect(() => {
    function closeFromOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }
    function closeFromEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('mousedown', closeFromOutside)
    document.addEventListener('keydown', closeFromEscape)
    return () => {
      document.removeEventListener('mousedown', closeFromOutside)
      document.removeEventListener('keydown', closeFromEscape)
    }
  }, [])

  function toggleMenu(menu: Exclude<MenuKey, null>) {
    setOpenMenu((current) => current === menu ? null : menu)
  }

  function applyFilters() {
    const params = new URLSearchParams()
    stages.forEach((value) => params.append('stage', value))
    purposes.forEach((value) => params.append('purpose', value))
    types.forEach((value) => params.append('type', value))
    params.set('sort', sortMode)
    params.set('direction', sortDirection)
    setOpenMenu(null)
    router.push(`/projects?${params.toString()}`)
  }

  function clearFilters() {
    const defaultSort: SortMode = showRecommended ? 'recommended' : 'published'
    setStages([])
    setPurposes([])
    setTypes([])
    setSortMode(defaultSort)
    setSortDirection('desc')
    setOpenMenu(null)
    router.push('/projects')
  }

  return (
    <div className="discovery-filter" ref={rootRef}>
      <div className="discovery-filter-menu">
        <button className={`discovery-filter-trigger ${openMenu === 'stage' ? 'is-open' : ''}`} type="button" aria-expanded={openMenu === 'stage'} onClick={() => toggleMenu('stage')}>
          {countLabel('全部阶段', stages.length)}
        </button>
        {openMenu === 'stage' && (
          <div className="discovery-filter-popover">
            <strong>项目阶段</strong>
            <p>可以多选，命中其中任意一个阶段即可。</p>
            <div className="discovery-filter-options">
              {Object.entries(PROJECT_STAGE_LABELS).map(([value, label]) => (
                <label key={value}>
                  <input checked={stages.includes(value)} type="checkbox" onChange={() => setStages((current) => toggleValue(current, value))} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="discovery-filter-menu">
        <button className={`discovery-filter-trigger ${openMenu === 'purpose' ? 'is-open' : ''}`} type="button" aria-expanded={openMenu === 'purpose'} onClick={() => toggleMenu('purpose')}>
          {countLabel('全部目的', purposes.length)}
        </button>
        {openMenu === 'purpose' && (
          <div className="discovery-filter-popover">
            <strong>这声咩想干嘛</strong>
            <p>找同行、试玩、反馈或分享，都可以一起筛。</p>
            <div className="discovery-filter-options">
              {Object.entries(PROJECT_PURPOSE_LABELS).map(([value, label]) => (
                <label key={value}>
                  <input checked={purposes.includes(value)} type="checkbox" onChange={() => setPurposes((current) => toggleValue(current, value))} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="discovery-filter-menu discovery-filter-menu-wide">
        <button className={`discovery-filter-trigger ${openMenu === 'type' ? 'is-open' : ''}`} type="button" aria-expanded={openMenu === 'type'} onClick={() => toggleMenu('type')}>
          {countLabel('全部标签', types.length)}
        </button>
        {openMenu === 'type' && (
          <div className="discovery-filter-popover discovery-filter-popover-wide">
            <strong>项目标签</strong>
            <p>同一组内可以多选；不同筛选条件会一起生效。</p>
            <div className="discovery-filter-tag-groups">
              {PROJECT_TAG_GROUPS.map((group) => (
                <section key={group.label}>
                  <h3>{group.label}</h3>
                  <div className="discovery-filter-options discovery-filter-options-tags">
                    {group.options.map((value) => (
                      <label key={value}>
                        <input checked={types.includes(value)} type="checkbox" onChange={() => setTypes((current) => toggleValue(current, value))} />
                        <span>{value}</span>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="discovery-filter-menu discovery-filter-menu-sort">
        <button className={`discovery-filter-trigger ${openMenu === 'sort' ? 'is-open' : ''}`} type="button" aria-expanded={openMenu === 'sort'} onClick={() => toggleMenu('sort')}>
          {SORT_LABELS[sortMode]}
        </button>
        {openMenu === 'sort' && (
          <div className="discovery-filter-popover discovery-filter-popover-compact">
            <strong>排序方式</strong>
            <div className="discovery-filter-options discovery-filter-radio-options">
              {availableSorts.map((value) => (
                <label key={value}>
                  <input checked={sortMode === value} name="sort-mode" type="radio" onChange={() => { setSortMode(value); setOpenMenu(null) }} />
                  <span>{SORT_LABELS[value]}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="discovery-filter-menu discovery-filter-menu-direction">
        <button className={`discovery-filter-trigger ${openMenu === 'direction' ? 'is-open' : ''}`} type="button" aria-expanded={openMenu === 'direction'} onClick={() => toggleMenu('direction')}>
          {sortDirection === 'desc' ? '倒序' : '正序'}
        </button>
        {openMenu === 'direction' && (
          <div className="discovery-filter-popover discovery-filter-popover-compact discovery-filter-popover-right">
            <strong>排列方向</strong>
            <p>{sortMode === 'published' ? '倒序是新到旧，正序是旧到新。' : '倒序是高到低，正序是低到高。'}</p>
            <div className="discovery-filter-options discovery-filter-radio-options">
              <label>
                <input checked={sortDirection === 'desc'} name="sort-direction" type="radio" onChange={() => { setSortDirection('desc'); setOpenMenu(null) }} />
                <span>倒序</span>
              </label>
              <label>
                <input checked={sortDirection === 'asc'} name="sort-direction" type="radio" onChange={() => { setSortDirection('asc'); setOpenMenu(null) }} />
                <span>正序</span>
              </label>
            </div>
          </div>
        )}
      </div>

      <button className="button button-primary button-compact" type="button" onClick={applyFilters}>筛一筛</button>
      <button className="story-link discovery-clear-button" type="button" onClick={clearFilters}>清空</button>
    </div>
  )
}
