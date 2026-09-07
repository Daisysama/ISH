import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { Portfolio } from '../api/types'
import { ErrorBox, Loading, PageHeader, STAGE_LABELS, formatDate } from '../components/common'
import { useApp } from '../state/AppContext'

export default function PortfolioPage() {
  const navigate = useNavigate()
  const { me, refreshMe, notify } = useApp()
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [bio, setBio] = useState(me?.bio ?? '')
  const [skills, setSkills] = useState((me?.skills ?? []).join(', '))

  useEffect(() => {
    api
      .get<Portfolio>('/api/me/portfolio')
      .then(setPortfolio)
      .catch((err) => setError(err.message))
  }, [])

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    try {
      await api.patch('/api/me', {
        bio,
        skills: skills
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
      })
      await refreshMe()
      notify('资料已更新')
    } catch (err) {
      notify(err instanceof Error ? err.message : '保存失败', true)
    }
  }

  return (
    <>
      <PageHeader
        title="项目履历"
        subtitle="UC-05 · Prove by Doing：让真实作品替代空洞的简历形容词。"
      />
      <ErrorBox message={error} />
      {!portfolio ? (
        <Loading what="履历" />
      ) : (
        <div className="hero">
          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="row">
                <span className="avatar" style={{ width: 52, height: 52, fontSize: 20 }}>
                  {portfolio.user.display_name.slice(0, 1)}
                </span>
                <div>
                  <h3 style={{ margin: 0 }}>{portfolio.user.display_name}</h3>
                  <div className="mini">@{portfolio.user.handle}</div>
                </div>
              </div>
              <div className="metric" style={{ marginTop: 16 }}>
                <span>参与项目</span>
                <b>{portfolio.project_count}</b>
              </div>
              <div className="metric">
                <span>公开成果</span>
                <b>{portfolio.work_count}</b>
              </div>
              <div className="metric">
                <span>真实合作过的人</span>
                <b>{portfolio.collaborators.length}</b>
              </div>
            </div>

            <div className="card">
              <h3>自我介绍</h3>
              <div className="kicker">
                这一块是你自己写的。下面的项目事实不是——它没有编辑入口。
              </div>
              <form onSubmit={saveProfile}>
                <div className="field">
                  <label>简介</label>
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
                </div>
                <div className="field">
                  <label>技能标签（逗号分隔）</label>
                  <input value={skills} onChange={(e) => setSkills(e.target.value)} />
                </div>
                <button className="btn">保存</button>
              </form>
            </div>
          </div>

          <div className="card">
            <h3>ISH Portfolio</h3>
            <div className="kicker">{portfolio.note}</div>
            {portfolio.projects.length === 0 ? (
              <div className="empty">
                参加一个真实项目之后，履历会自己长出来。
                <div style={{ marginTop: 12 }}>
                  <button className="btn small" onClick={() => navigate('/discover')}>
                    去找一个项目
                  </button>
                </div>
              </div>
            ) : (
              portfolio.projects.map((entry) => (
                <div className="clause" key={entry.project_id}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <b
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/projects/${entry.project_id}`)}
                    >
                      {entry.title}
                    </b>
                    <span className="tag">{STAGE_LABELS[entry.stage] ?? entry.stage}</span>
                  </div>
                  <div className="mini">
                    角色：{entry.role}
                    {entry.is_owner ? '（发起人）' : ''} · 加入于 {formatDate(entry.joined_at)}
                  </div>
                  <div className="mini">
                    我完成的航标 {entry.milestones_completed_by_user}/{entry.milestones_total} ·
                    我提交的成果 {entry.deliverables_by_user} 件 ·{' '}
                    {entry.agreement_version_signed
                      ? `已确认契约 v${entry.agreement_version_signed}`
                      : '未确认当前契约'}
                  </div>
                  {entry.works.length > 0 && (
                    <div className="tags">
                      {entry.works.map((work) => (
                        <span className="tag brand" key={work}>
                          {work}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}

            {portfolio.collaborators.length > 0 && (
              <>
                <h3 style={{ marginTop: 20 }}>Collaboration Graph</h3>
                <div className="kicker">真正和你一起做过事情的人。</div>
                <div className="tags">
                  {portfolio.collaborators.map((user) => (
                    <span className="tag" key={user.id}>
                      {user.display_name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
