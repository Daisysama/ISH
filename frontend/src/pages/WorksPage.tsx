import { useCallback, useEffect, useState } from 'react'

import { api } from '../api/client'
import type { Work } from '../api/types'
import { ErrorBox, Loading, PageHeader, formatDate } from '../components/common'
import { useApp } from '../state/AppContext'

const TASTE_POOL = [
  '强剧情',
  '慢热',
  '科幻',
  '心理恐怖',
  '探索',
  '大量阅读',
  '高操作',
  '轻松',
  '无战斗',
]

const RELATION_LABELS: Record<string, string> = {
  none: '无商业关系',
  publishing: 'ISH 参与发行',
  paid_promotion: '付费广告合作',
  equity: 'ISH 持有项目权益',
}

export default function WorksPage() {
  const { me, notify } = useApp()
  const [works, setWorks] = useState<Work[] | null>(null)
  const [taste, setTaste] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [curating, setCurating] = useState<Work | null>(null)

  const load = useCallback(async () => {
    try {
      const [w, t] = await Promise.all([
        api.get<Work[]>('/api/works'),
        api.get<string[]>('/api/me/taste'),
      ])
      setWorks(w)
      setTaste(t)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleTaste(tag: string) {
    const next = taste.includes(tag) ? taste.filter((t) => t !== tag) : [...taste, tag]
    setTaste(next)
    await api.put('/api/me/taste', { tags: next })
    setWorks(await api.get<Work[]>('/api/works'))
  }

  return (
    <>
      <PageHeader
        title="作品与推荐"
        subtitle="UC-07 / UC-08 · 不只问「热不热」，还问「它究竟适合谁」。"
      />
      <ErrorBox message={error} />

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>你的口味</h3>
        <div className="kicker">
          点一下就改推荐顺序。排序只受编辑标注和你的口味影响——商业关系只披露，不参与排序。
        </div>
        <div className="row">
          {TASTE_POOL.map((tag) => (
            <button
              key={tag}
              className={`taste-chip${taste.includes(tag) ? ' selected' : ''}`}
              onClick={() => toggleTaste(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {works === null ? (
        <Loading what="作品" />
      ) : works.length === 0 ? (
        <div className="empty">还没有作品。完成一个航标之后就可以在项目页发布成果。</div>
      ) : (
        <div className="grid">
          {works.map((work) => (
            <article className="card" key={work.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="tag brand">{work.kind}</span>
                <span
                  className={`tag${
                    work.disclosure.includes('无商业关系') ? '' : ' danger'
                  }`}
                  title="UC-09 · 商业关系必须公开披露"
                >
                  {work.disclosure}
                </span>
              </div>
              <h3 style={{ marginTop: 8 }}>{work.title}</h3>
              <div className="mini">
                Born on ISH · 来自项目《{work.project_title}》· {formatDate(work.published_at)}
              </div>
              <p style={{ fontSize: 14 }}>{work.summary}</p>

              <div className="tags">
                {work.tags.map((tag) => (
                  <span
                    className={`tag${taste.includes(tag.tag) ? ' dark' : ''}`}
                    key={`${tag.source}-${tag.tag}`}
                    title={tag.source === 'curator' ? 'ISH 编辑标注' : '团队自己的标签'}
                  >
                    {tag.tag}
                    {tag.source === 'curator' ? ' ·编辑' : ''}
                  </span>
                ))}
              </div>

              {work.curation ? (
                <>
                  <div className="clause">
                    <b>适合</b>
                    {work.curation.fit || '编辑尚未填写'}
                  </div>
                  <div className="clause">
                    <b>慎入</b>
                    {work.curation.avoid || '编辑尚未填写'}
                  </div>
                  {Object.entries(work.curation.metrics).map(([key, value]) => (
                    <div className="scoreline" key={key}>
                      <span>{key}</span>
                      <div className="bar">
                        <i style={{ width: `${value}%` }} />
                      </div>
                      <span>{value}</span>
                    </div>
                  ))}
                  {work.curation.editorial && (
                    <div className="mini" style={{ marginTop: 8 }}>
                      编辑说：{work.curation.editorial}
                    </div>
                  )}
                </>
              ) : (
                <div className="notice">ISH 编辑还没有实际体验过这个作品。</div>
              )}

              <div className="mini" style={{ marginTop: 10 }}>
                <b>为什么推荐给你（{work.match_score} 分）</b>
                {work.match_reasons.length === 0 ? (
                  <div>暂时没有命中你的口味标签。</div>
                ) : (
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {work.match_reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <span className="mini" style={{ flex: 1 }}>
                  署名：{work.credits.map((c) => c.user.display_name).join('、')}
                </span>
                {me?.is_curator && (
                  <button className="btn small" onClick={() => setCurating(work)}>
                    编辑标注
                  </button>
                )}
                {work.url && (
                  <a className="btn small primary" href={work.url} target="_blank" rel="noreferrer">
                    查看作品
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {curating && (
        <CurationForm
          work={curating}
          onClose={() => setCurating(null)}
          onSaved={async () => {
            setCurating(null)
            notify('标注已更新并进入透明度日志')
            await load()
          }}
        />
      )}
    </>
  )
}

function CurationForm({
  work,
  onClose,
  onSaved,
}: {
  work: Work
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const curation = work.curation

  return (
    <div className="card" style={{ marginTop: 18, borderColor: 'var(--brand)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>理解作品 · {work.title}</h3>
        <button className="btn small" onClick={onClose}>
          关闭
        </button>
      </div>
      <div className="kicker">
        UC-07 · 不是给一个总分，是描述它是什么、谁会喜欢、谁该慎入。只有 ISH 编辑能写这里。
      </div>
      <ErrorBox message={error} />
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          const metrics: Record<string, number> = {}
          for (const key of ['剧情密度', '操作负担', '情绪强度', '探索自由']) {
            metrics[key] = Number(form.get(key) || 0)
          }
          try {
            await api.put(`/api/works/${work.id}/curation`, {
              fit: form.get('fit'),
              avoid: form.get('avoid'),
              editorial: form.get('editorial'),
              commercial_relation: form.get('commercial_relation'),
              metrics,
              audience_tags: String(form.get('audience_tags') || '')
                .split(/[,，]/)
                .map((s) => s.trim())
                .filter(Boolean),
              tags: String(form.get('tags') || '')
                .split(/[,，]/)
                .map((s) => s.trim())
                .filter(Boolean),
            })
            onSaved()
          } catch (err) {
            setError(err instanceof Error ? err.message : '保存失败')
          }
        }}
      >
        <div className="field">
          <label>适合谁</label>
          <textarea name="fit" defaultValue={curation?.fit ?? ''} />
        </div>
        <div className="field">
          <label>谁该慎入</label>
          <textarea name="avoid" defaultValue={curation?.avoid ?? ''} />
        </div>
        <div className="field">
          <label>编辑说明（你实际体验后的判断）</label>
          <textarea name="editorial" defaultValue={curation?.editorial ?? ''} />
        </div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          {['剧情密度', '操作负担', '情绪强度', '探索自由'].map((key) => (
            <div className="field" style={{ flex: 1, minWidth: 130 }} key={key}>
              <label>{key}（0-100）</label>
              <input
                name={key}
                type="number"
                min={0}
                max={100}
                defaultValue={curation?.metrics[key] ?? 50}
              />
            </div>
          ))}
        </div>
        <div className="field">
          <label>受众标签（用于匹配，逗号分隔）</label>
          <input name="audience_tags" defaultValue={(curation?.audience_tags ?? []).join(', ')} />
        </div>
        <div className="field">
          <label>编辑补充的作品标签</label>
          <input
            name="tags"
            defaultValue={work.tags
              .filter((t) => t.source === 'curator')
              .map((t) => t.tag)
              .join(', ')}
          />
        </div>
        <div className="field">
          <label>ISH 与这个作品的商业关系</label>
          <select name="commercial_relation" defaultValue={curation?.commercial_relation ?? 'none'}>
            {Object.entries(RELATION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="help">
            无论选哪个，它都不会影响推荐排序，只会显示在作品卡片和披露清单上。
          </span>
        </div>
        <button className="btn brand">保存并公开披露</button>
      </form>
    </div>
  )
}
