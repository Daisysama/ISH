import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { ProjectDetail } from '../api/types'
import { ErrorBox, MODE_LABELS, PageHeader } from '../components/common'
import { useApp } from '../state/AppContext'

const CATEGORIES = [
  '独立游戏',
  'Galgame',
  '短片/纪录片',
  '音乐',
  '小说/IP',
  '软件/AI',
  '其他',
]

export default function CreateWishPage() {
  const navigate = useNavigate()
  const { notify } = useApp()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    const form = new FormData(event.currentTarget)
    try {
      const project = await api.post<ProjectDetail>('/api/projects', {
        title: form.get('title'),
        summary: form.get('summary'),
        category: form.get('category'),
        mode: form.get('mode'),
        duration: form.get('duration') || '待议',
        assets: form.get('assets') || '',
        owner_role: form.get('owner_role') || '发起人',
        needs: String(form.get('needs') || '')
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
      })
      notify('愿望已发布，契约草案已经生成')
      navigate(`/projects/${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="发一个愿"
        subtitle="UC-01 · 把「我有个想法」变成别人能够理解和响应的项目节点。"
      />
      <div className="card" style={{ maxWidth: 820 }}>
        <ErrorBox message={error} />
        <form onSubmit={submit}>
          <div className="field">
            <label>项目名称</label>
            <input name="title" required placeholder="例如：一部关于凌晨四点县城的纪录片" />
          </div>
          <div className="field">
            <label>你想做什么</label>
            <textarea
              name="summary"
              required
              minLength={10}
              placeholder="不要写招聘 JD。告诉别人为什么这件事值得一起做。"
            />
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="field" style={{ flex: 1, minWidth: 200 }}>
              <label>类型</label>
              <select name="category" defaultValue="独立游戏">
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 200 }}>
              <label>预计周期</label>
              <input name="duration" placeholder="例如：3 个月" />
            </div>
          </div>
          <div className="field">
            <label>你已经拥有什么</label>
            <textarea
              name="assets"
              placeholder="例如：两万字剧本初稿、十二小时素材、一个能跑的原型。"
            />
            <span className="help">交代家底能显著提高别人愿意加入的概率。</span>
          </div>
          <div className="field">
            <label>还缺什么人（逗号分隔）</label>
            <input name="needs" placeholder="例如：程序, 像素美术, 配乐" />
          </div>
          <div className="field">
            <label>你在项目里的角色</label>
            <input name="owner_role" defaultValue="发起人" />
          </div>
          <div className="field">
            <label>当前合作性质</label>
            <select name="mode" defaultValue="interest">
              {Object.entries(MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="clause">
            <b>ISH 的规矩</b>
            钱可以暂时没有，合作边界不能没有。项目创建时会自动生成一份 v1
            契约草案，团队成员必须确认之后才能推进航标。
          </div>
          <button className="btn brand" type="submit" disabled={busy}>
            发布愿望
          </button>
        </form>
      </div>
    </>
  )
}
