import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { ProjectSummary } from '../api/types'
import { ErrorBox, Loading, PageHeader, ProjectCard } from '../components/common'

export default function DiscoverPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [need, setNeed] = useState('')

  useEffect(() => {
    let cancelled = false
    setProjects(null)
    api
      .get<ProjectSummary[]>('/api/projects', { q, need })
      .then((data) => !cancelled && setProjects(data))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [q, need])

  return (
    <>
      <PageHeader
        title="发现项目"
        subtitle="UC-02 · 不是看招聘列表，是找一件你真的想一起做的事。"
        actions={
          <button className="btn brand" onClick={() => navigate('/create')}>
            ＋ 发愿
          </button>
        }
      />

      <div className="hero">
        <div className="hero-main">
          <div className="eyebrow">Primary User Story</div>
          <h3>让一个想法找到真正的同行者</h3>
          <p className="muted" style={{ maxWidth: 620 }}>
            不必先成立公司、招聘员工或者拥有大量资金。先把想做的事说清楚，
            让合适的人围绕它聚起来。
          </p>
          <div className="flow">
            <span>Idea</span>
            <span>→ People</span>
            <span>→ Trust</span>
            <span>→ Execution</span>
            <span>→ Work</span>
            <span>→ Audience</span>
          </div>
        </div>
        <div className="card">
          <h3>筛选</h3>
          <div className="field" style={{ marginTop: 12 }}>
            <label>搜索</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="项目名 / 简介 / 类型"
            />
          </div>
          <div className="field">
            <label>我能补上的角色</label>
            <input
              value={need}
              onChange={(e) => setNeed(e.target.value)}
              placeholder="例如：配乐、Unity 程序"
            />
          </div>
          <span className="mini">只列出还缺这个角色的项目。</span>
        </div>
      </div>

      <ErrorBox message={error} />
      {projects === null ? (
        <Loading what="项目" />
      ) : projects.length === 0 ? (
        <div className="empty">没有匹配的项目。换个词，或者自己发一个愿。</div>
      ) : (
        <div className="grid">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={(id) => navigate(`/projects/${id}`)}
            />
          ))}
        </div>
      )}
    </>
  )
}
