import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import type {
  Agreement,
  Application,
  Health,
  Milestone,
  ProjectDetail,
  ProjectEvent,
} from '../api/types'
import {
  ErrorBox,
  Loading,
  MODE_LABELS,
  PageHeader,
  STAGE_LABELS,
  formatDate,
  formatDateTime,
} from '../components/common'
import { useApp } from '../state/AppContext'

type Tab = 'overview' | 'applications' | 'agreement' | 'milestones' | 'publish'

export default function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { notify } = useApp()

  const [tab, setTab] = useState<Tab>('overview')
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [agreement, setAgreement] = useState<Agreement | null>(null)
  const [history, setHistory] = useState<Agreement[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [events, setEvents] = useState<ProjectEvent[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const detail = await api.get<ProjectDetail>(`/api/projects/${projectId}`)
      setProject(detail)
      const [ms, ev, hp] = await Promise.all([
        api.get<Milestone[]>(`/api/projects/${projectId}/milestones`),
        api.get<ProjectEvent[]>(`/api/projects/${projectId}/events`),
        api.get<Health>(`/api/projects/${projectId}/health`),
      ])
      setMilestones(ms)
      setEvents(ev)
      setHealth(hp)
      try {
        setAgreement(await api.get<Agreement>(`/api/projects/${projectId}/agreement`))
        setHistory(await api.get<Agreement[]>(`/api/projects/${projectId}/agreements`))
      } catch {
        setAgreement(null)
      }
      if (detail.viewer_is_member) {
        setApplications(await api.get<Application[]>(`/api/projects/${projectId}/applications`))
      } else {
        setApplications([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  async function run(action: () => Promise<unknown>, okMessage: string) {
    setBusy(true)
    try {
      await action()
      notify(okMessage)
      await load()
    } catch (err) {
      notify(err instanceof Error ? err.message : '操作失败', true)
    } finally {
      setBusy(false)
    }
  }

  if (error) return <ErrorBox message={error} />
  if (!project) return <Loading what="项目" />

  const pct = project.milestones_total
    ? Math.round((project.milestones_done / project.milestones_total) * 100)
    : 0
  const canAct = project.viewer_is_member && project.viewer_agreement_signed
  const pendingApplications = applications.filter((a) => a.status === 'pending')

  return (
    <>
      <PageHeader
        title={project.title}
        subtitle={`Born on ISH · ${formatDate(project.created_at)} · ${
          MODE_LABELS[project.mode] ?? project.mode
        }`}
        actions={
          <>
            <button className="btn small" onClick={() => navigate(-1)}>
              返回
            </button>
            {!project.viewer_is_member && !project.viewer_has_pending_application && (
              <button className="btn brand" onClick={() => setTab('applications')}>
                愿同行
              </button>
            )}
            {project.viewer_has_pending_application && (
              <span className="tag warn">申请已提交，等待回应</span>
            )}
          </>
        }
      />

      {project.viewer_is_member && !project.viewer_agreement_signed && agreement && (
        <div className="notice">
          你还没有确认契约 v{agreement.version}，目前不处于正式合作状态，
          无法新增或完成航标。
          <button
            className="btn small"
            style={{ marginLeft: 10 }}
            onClick={() => setTab('agreement')}
          >
            去确认
          </button>
        </div>
      )}

      <div className="tabs">
        {(
          [
            ['overview', '项目'],
            ['applications', `愿同行${pendingApplications.length ? ` (${pendingApplications.length})` : ''}`],
            ['agreement', '立契'],
            ['milestones', '航标'],
            ['publish', '成事'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={`tab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="hero">
          <div className="card">
            <div className="kicker">项目简介</div>
            <p>{project.summary}</p>
            {project.assets && (
              <div className="clause">
                <b>已经拥有</b>
                {project.assets}
              </div>
            )}
            <div className="tags">
              <span className="tag brand">{project.category}</span>
              {project.needs.map((need) => (
                <span className="tag" key={need}>
                  缺 {need}
                </span>
              ))}
            </div>

            <h3 style={{ marginTop: 20 }}>团队</h3>
            {project.members.map((member) => (
              <div className="clause" key={member.user.id}>
                <b>
                  {member.user.display_name} · {member.role}
                  {member.is_owner ? ' · 发起人' : ''}
                </b>
                <span className="mini">
                  加入于 {formatDate(member.joined_at)} ·{' '}
                  {member.agreement_signed ? '已确认当前契约' : '尚未确认当前契约'}
                </span>
              </div>
            ))}

            <h3 style={{ marginTop: 20 }}>项目轨迹</h3>
            <div className="timeline">
              {events.map((event) => (
                <div className="timeline-item" key={event.id}>
                  <b style={{ fontSize: 14 }}>{event.text}</b>
                  <div className="mini">{formatDateTime(event.created_at)}</div>
                </div>
              ))}
              {events.length === 0 && <span className="mini">还没有轨迹。</span>}
            </div>
          </div>

          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="mini">当前阶段</div>
              <b style={{ fontSize: 18 }}>{STAGE_LABELS[project.stage] ?? project.stage}</b>
              <div className="progressbar" style={{ margin: '10px 0' }}>
                <i style={{ width: `${pct}%` }} />
              </div>
              <div className="mini">
                {project.milestones_done}/{project.milestones_total} 个航标完成
              </div>
              <div className="metric" style={{ marginTop: 12 }}>
                <span>合作模式</span>
                <span style={{ fontSize: 13, textAlign: 'right' }}>
                  {MODE_LABELS[project.mode] ?? project.mode}
                </span>
              </div>
              <div className="metric">
                <span>预计周期</span>
                <b>{project.duration}</b>
              </div>
              <div className="metric">
                <span>契约版本</span>
                <b>v{project.agreement_version ?? '—'}</b>
              </div>
            </div>
            {health && (
              <div className={health.stalled ? 'notice' : 'card'}>
                <div className="kicker" style={{ marginBottom: 6 }}>
                  项目状态（UC-04 · 不催日报）
                </div>
                {health.hint}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'applications' && (
        <ApplicationsTab
          project={project}
          applications={applications}
          busy={busy}
          onApply={(body) =>
            run(
              () => api.post(`/api/projects/${project.id}/applications`, body),
              '申请已提交',
            )
          }
          onDecide={(id, accept) =>
            run(
              () => api.post(`/api/applications/${id}/${accept ? 'accept' : 'reject'}`),
              accept ? '已接受加入' : '已拒绝',
            )
          }
        />
      )}

      {tab === 'agreement' && (
        <AgreementTab
          project={project}
          agreement={agreement}
          history={history}
          busy={busy}
          onAccept={() =>
            run(() => api.post(`/api/agreements/${agreement!.id}/accept`), '契约已确认')
          }
          onPublish={(clauses, note) =>
            run(
              () =>
                api.post(`/api/projects/${project.id}/agreements`, {
                  clauses,
                  change_note: note,
                }),
              '新版本已发布，全体成员需要重新确认',
            )
          }
        />
      )}

      {tab === 'milestones' && (
        <MilestonesTab
          milestones={milestones}
          canAct={canAct}
          busy={busy}
          onAdd={(name, description) =>
            run(
              () => api.post(`/api/projects/${project.id}/milestones`, { name, description }),
              '航标已添加',
            )
          }
          onToggle={(milestone) =>
            run(
              () =>
                api.post(
                  `/api/milestones/${milestone.id}/${
                    milestone.status === 'done' ? 'reopen' : 'complete'
                  }`,
                ),
              milestone.status === 'done' ? '航标已重新打开' : '航标已完成',
            )
          }
          onDeliverable={(milestoneId, title, url) =>
            run(
              () => api.post(`/api/milestones/${milestoneId}/deliverables`, { title, url }),
              '成果已提交',
            )
          }
        />
      )}

      {tab === 'publish' && (
        <PublishTab
          project={project}
          canAct={canAct}
          milestonesDone={project.milestones_done}
          busy={busy}
          onPublish={(body) =>
            run(async () => {
              await api.post(`/api/projects/${project.id}/works`, body)
              navigate('/works')
            }, '作品页已生成')
          }
        />
      )}
    </>
  )
}

// ------------------------------------------------------------------ UC-02

function ApplicationsTab({
  project,
  applications,
  busy,
  onApply,
  onDecide,
}: {
  project: ProjectDetail
  applications: Application[]
  busy: boolean
  onApply: (body: Record<string, string>) => void
  onDecide: (id: string, accept: boolean) => void
}) {
  if (!project.viewer_is_member) {
    if (project.viewer_has_pending_application) {
      return <div className="empty">你的申请已经提交，等待发起人回应。</div>
    }
    return (
      <div className="card" style={{ maxWidth: 720 }}>
        <h3>愿同行</h3>
        <div className="kicker">
          UC-02 · 不投简历。告诉团队你能一起做什么，以及为什么想做这件事。
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            onApply({
              role: String(form.get('role')),
              why: String(form.get('why')),
              time_commitment: String(form.get('time_commitment') || ''),
              proof: String(form.get('proof') || ''),
            })
          }}
        >
          <div className="field">
            <label>我能贡献什么</label>
            <input name="role" required placeholder="例如：配乐 / Unity 程序 / 剪辑" />
          </div>
          <div className="field">
            <label>为什么想参加</label>
            <textarea name="why" required minLength={5} />
          </div>
          <div className="field">
            <label>每周大概能投入</label>
            <input name="time_commitment" placeholder="例如：6-8 小时" />
          </div>
          <div className="field">
            <label>作品 / 经历</label>
            <textarea name="proof" placeholder="没有作品也可以直接写你做过什么。" />
          </div>
          <button className="btn brand" disabled={busy}>
            提交申请
          </button>
        </form>
      </div>
    )
  }

  if (applications.length === 0) return <div className="empty">还没有人申请加入。</div>

  return (
    <div className="grid">
      {applications.map((application) => (
        <div className="card" key={application.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{application.applicant.display_name}</b>
            <span
              className={`tag${
                application.status === 'accepted'
                  ? ' brand'
                  : application.status === 'pending'
                    ? ' warn'
                    : ''
              }`}
            >
              {application.status}
            </span>
          </div>
          <div className="mini">
            @{application.applicant.handle} · 想做「{application.role}」
          </div>
          <p style={{ fontSize: 14 }}>{application.why}</p>
          {application.time_commitment && (
            <div className="mini">每周投入：{application.time_commitment}</div>
          )}
          {application.proof && <div className="clause">{application.proof}</div>}
          {application.status === 'pending' && project.viewer_is_owner && (
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="btn primary small"
                disabled={busy}
                onClick={() => onDecide(application.id, true)}
              >
                接受加入
              </button>
              <button
                className="btn small"
                disabled={busy}
                onClick={() => onDecide(application.id, false)}
              >
                暂不接受
              </button>
            </div>
          )}
          {application.status === 'pending' && !project.viewer_is_owner && (
            <div className="mini" style={{ marginTop: 8 }}>
              只有发起人可以决定是否接受。
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ UC-03

function AgreementTab({
  project,
  agreement,
  history,
  busy,
  onAccept,
  onPublish,
}: {
  project: ProjectDetail
  agreement: Agreement | null
  history: Agreement[]
  busy: boolean
  onAccept: () => void
  onPublish: (clauses: { key: string; title: string; body: string }[], note: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(agreement?.clauses ?? [])
  const [note, setNote] = useState('')

  useEffect(() => {
    setDraft(agreement?.clauses ?? [])
  }, [agreement])

  if (!agreement) return <div className="empty">这个项目还没有契约。</div>

  return (
    <div className="hero">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>项目契约 v{agreement.version}</h3>
          <span className="mini">发布于 {formatDate(agreement.created_at)}</span>
        </div>
        <div className="kicker">
          UC-03 · 在投入大量时间之前，把最容易日后翻脸的问题说清楚。
        </div>

        {!editing &&
          agreement.clauses.map((clause) => (
            <div className="clause" key={clause.key}>
              <b>{clause.title}</b>
              {clause.body}
            </div>
          ))}

        {editing && (
          <>
            {draft.map((clause, index) => (
              <div className="field" key={clause.key}>
                <label>{clause.title}</label>
                <textarea
                  value={clause.body}
                  onChange={(e) => {
                    const next = [...draft]
                    next[index] = { ...clause, body: e.target.value }
                    setDraft(next)
                  }}
                />
              </div>
            ))}
            <div className="field">
              <label>变更说明</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="改了什么，为什么改"
              />
            </div>
            <div className="notice">
              发布新版本后，所有成员（包括你自己）的确认都会失效，必须重新确认才能继续推进项目。
            </div>
            <div className="row">
              <button
                className="btn brand"
                disabled={busy}
                onClick={() => {
                  onPublish(draft, note)
                  setEditing(false)
                  setNote('')
                }}
              >
                发布 v{agreement.version + 1}
              </button>
              <button className="btn" onClick={() => setEditing(false)}>
                取消
              </button>
            </div>
          </>
        )}

        {!editing && (
          <div className="row" style={{ marginTop: 14 }}>
            {project.viewer_is_member && !agreement.viewer_accepted && (
              <button className="btn brand" disabled={busy} onClick={onAccept}>
                我已阅读并确认
              </button>
            )}
            {project.viewer_is_member && agreement.viewer_accepted && (
              <span className="tag brand">你已确认这个版本</span>
            )}
            {project.viewer_is_owner && (
              <button className="btn" onClick={() => setEditing(true)}>
                修改并发布新版本
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>确认状态</h3>
          <div className="kicker">确认绑定在版本上，改版本 = 全体重新确认。</div>
          {agreement.accepted_by.map((item) => (
            <div className="metric" key={item.user.id}>
              <span>{item.user.display_name}</span>
              <span className="tag brand">已确认</span>
            </div>
          ))}
          {agreement.pending.map((user) => (
            <div className="metric" key={user.id}>
              <span>{user.display_name}</span>
              <span className="tag warn">待确认</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>版本历史</h3>
          <div className="kicker">旧版本不会被改写，只会被标记取代。</div>
          {history.map((item) => (
            <div className="clause" key={item.id}>
              <b>
                v{item.version}
                {item.superseded_at ? ' · 已被取代' : ' · 当前版本'}
              </b>
              <span className="mini">
                {formatDate(item.created_at)} · {item.change_note || '无变更说明'} ·{' '}
                {item.accepted_by.length} 人确认过
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ UC-04

function MilestonesTab({
  milestones,
  canAct,
  busy,
  onAdd,
  onToggle,
  onDeliverable,
}: {
  milestones: Milestone[]
  canAct: boolean
  busy: boolean
  onAdd: (name: string, description: string) => void
  onToggle: (milestone: Milestone) => void
  onDeliverable: (milestoneId: string, title: string, url: string) => void
}) {
  const [openForm, setOpenForm] = useState<string | null>(null)

  return (
    <div className="hero">
      <div className="card">
        <h3>航标 / Milestones</h3>
        <div className="kicker">
          UC-04 · 没有日报，没有工时打卡。只有真实成果推进阶段。
        </div>
        {milestones.map((milestone) => (
          <div key={milestone.id}>
            <div className="milestone">
              <button
                className={`check${milestone.status === 'done' ? ' done' : ''}`}
                disabled={!canAct || busy}
                onClick={() => onToggle(milestone)}
                title={canAct ? '切换完成状态' : '确认契约后才能推进航标'}
              >
                {milestone.status === 'done' ? '✓' : ''}
              </button>
              <div style={{ flex: 1 }}>
                <b>{milestone.name}</b>
                {milestone.description && (
                  <div className="mini">{milestone.description}</div>
                )}
                <div className="mini">
                  {milestone.status === 'done'
                    ? `由 ${milestone.completed_by?.display_name ?? '—'} 完成于 ${
                        milestone.completed_at ? formatDate(milestone.completed_at) : '—'
                      }`
                    : '待完成'}
                  {milestone.stage ? ` · 对应阶段 ${STAGE_LABELS[milestone.stage]}` : ''}
                </div>
                {milestone.deliverables.map((deliverable) => (
                  <div className="mini" key={deliverable.id}>
                    ↳ 成果：{deliverable.title}（{deliverable.created_by.display_name}）
                  </div>
                ))}
                {canAct && (
                  <button
                    className="btn small ghost"
                    style={{ marginTop: 8 }}
                    onClick={() =>
                      setOpenForm(openForm === milestone.id ? null : milestone.id)
                    }
                  >
                    ＋ 提交成果
                  </button>
                )}
                {openForm === milestone.id && (
                  <form
                    style={{ marginTop: 8 }}
                    onSubmit={(e) => {
                      e.preventDefault()
                      const form = new FormData(e.currentTarget)
                      onDeliverable(
                        milestone.id,
                        String(form.get('title')),
                        String(form.get('url') || ''),
                      )
                      setOpenForm(null)
                    }}
                  >
                    <div className="field">
                      <input name="title" required placeholder="成果名称，例如 build 0.3" />
                    </div>
                    <div className="field">
                      <input name="url" placeholder="链接（可选）" />
                    </div>
                    <button className="btn small primary" disabled={busy}>
                      提交
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ))}
        {milestones.length === 0 && <div className="empty">还没有航标。</div>}
      </div>

      <div className="card">
        <h3>添加航标</h3>
        <div className="kicker">下一个做出什么才算真的前进了？</div>
        {canAct ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const form = new FormData(e.currentTarget)
              onAdd(String(form.get('name')), String(form.get('description') || ''))
              e.currentTarget.reset()
            }}
          >
            <div className="field">
              <label>航标名称</label>
              <input name="name" required placeholder="例如：可玩 Demo" />
            </div>
            <div className="field">
              <label>怎样算完成</label>
              <textarea name="description" placeholder="写清楚验收标准，避免以后扯皮。" />
            </div>
            <button className="btn brand" disabled={busy}>
              添加
            </button>
          </form>
        ) : (
          <div className="notice">确认当前版本契约之后才能新增或完成航标。</div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ UC-06

function PublishTab({
  project,
  canAct,
  milestonesDone,
  busy,
  onPublish,
}: {
  project: ProjectDetail
  canAct: boolean
  milestonesDone: number
  busy: boolean
  onPublish: (body: Record<string, unknown>) => void
}) {
  if (!project.viewer_is_member) {
    return <div className="empty">加入团队之后才能发布成果。</div>
  }
  if (!canAct) {
    return <div className="notice">确认当前版本契约之后才能发布成果。</div>
  }
  if (milestonesDone === 0) {
    return (
      <div className="empty">
        至少完成一个航标之后才能发布作品页。
        <div className="mini" style={{ marginTop: 8 }}>
          作品页是执行的结果，不是另一个宣传入口。
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ maxWidth: 760 }}>
      <h3>发布项目成果</h3>
      <div className="kicker">UC-06 · Execution → Work。作品页会带上完整的项目血缘和署名。</div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          onPublish({
            title: form.get('title'),
            summary: form.get('summary') || '',
            url: form.get('url') || '',
            tags: String(form.get('tags') || '')
              .split(/[,，]/)
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }}
      >
        <div className="field">
          <label>作品名称</label>
          <input name="title" required defaultValue={project.title} />
        </div>
        <div className="field">
          <label>一句话介绍</label>
          <textarea name="summary" defaultValue={project.summary} />
        </div>
        <div className="field">
          <label>作品链接</label>
          <input name="url" placeholder="Steam / B站 / 网站 / Demo 链接" />
        </div>
        <div className="field">
          <label>团队自己的标签（逗号分隔）</label>
          <input name="tags" placeholder="例如：强剧情, 慢热" />
          <span className="help">
            「适合谁 / 不适合谁」由 ISH 编辑实际体验后标注，团队不能自己写。
          </span>
        </div>
        <button className="btn brand" disabled={busy}>
          生成作品页
        </button>
      </form>
    </div>
  )
}
