import type { ReactNode } from 'react'

import type { ProjectSummary } from '../api/types'

export const MODE_LABELS: Record<string, string> = {
  interest: '兴趣共创 · 暂无金钱交换',
  interest_then_revenue: '兴趣共创 · 商业化后重新确认收益',
  commercial: '商业项目 · 有预算',
  open_source: '非商业 / 开源',
}

export const STAGE_LABELS: Record<string, string> = {
  concept: 'Concept 概念',
  prototype: 'Prototype 原型',
  vertical_slice: 'Vertical Slice 纵切片',
  demo: 'Demo 试玩版',
  beta: 'Beta 测试',
  release: 'Release 发行',
  archived: 'Archived 归档',
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="topbar">
      <div>
        <h2>{title}</h2>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  )
}

export function Loading({ what = '内容' }: { what?: string }) {
  return <div className="empty">正在加载{what}…</div>
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null
  return <div className="error">{message}</div>
}

export function Avatar({ name }: { name: string }) {
  return <span className="avatar">{name.slice(0, 1)}</span>
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ProjectCard({
  project,
  onOpen,
}: {
  project: ProjectSummary
  onOpen: (id: string) => void
}) {
  const pct = project.milestones_total
    ? Math.round((project.milestones_done / project.milestones_total) * 100)
    : 0
  return (
    <article className="card project-card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="tag brand">{project.category}</span>
        <span className="mini">{STAGE_LABELS[project.stage] ?? project.stage}</span>
      </div>
      <h3 style={{ marginTop: 8 }}>{project.title}</h3>
      <p className="mini" style={{ fontSize: 13, color: '#5d635b' }}>
        {project.summary.length > 90 ? `${project.summary.slice(0, 90)}…` : project.summary}
      </p>
      <div className="tags">
        {project.needs.map((need) => (
          <span className="tag" key={need}>
            缺 {need}
          </span>
        ))}
        <span className="tag warn">{MODE_LABELS[project.mode] ?? project.mode}</span>
      </div>
      <div className="mini">
        航标 {project.milestones_done}/{project.milestones_total} · {project.member_count} 人
      </div>
      <div className="progressbar" style={{ margin: '7px 0 12px' }}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="footer">
        <span className="mini">发起人 {project.owner.display_name}</span>
        <button className="btn small" onClick={() => onOpen(project.id)}>
          查看
        </button>
      </div>
    </article>
  )
}
