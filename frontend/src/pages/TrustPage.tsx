import { useEffect, useState } from 'react'

import { api } from '../api/client'
import type { AuditEvent, ChainVerify, Disclosure, Principle } from '../api/types'
import { ErrorBox, Loading, PageHeader, formatDateTime } from '../components/common'

export default function TrustPage() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  const [verify, setVerify] = useState<ChainVerify | null>(null)
  const [principles, setPrinciples] = useState<Principle[]>([])
  const [disclosures, setDisclosures] = useState<Disclosure[]>([])
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<AuditEvent[]>('/api/audit', { limit: 100 }),
      api.get<ChainVerify>('/api/audit/verify'),
      api.get<Principle[]>('/api/transparency/principles'),
      api.get<Disclosure[]>('/api/transparency/disclosures'),
    ])
      .then(([e, v, p, d]) => {
        setEvents(e)
        setVerify(v)
        setPrinciples(p)
        setDisclosures(d)
      })
      .catch((err) => setError(err.message))
  }, [])

  async function recheck() {
    setChecking(true)
    try {
      setVerify(await api.get<ChainVerify>('/api/audit/verify'))
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <PageHeader
        title="透明度与信任"
        subtitle="UC-09 · 不要求你相信 ISH 是好人，而是让你可以自己验证。"
      />
      <ErrorBox message={error} />

      <div className="hero">
        <div className="card">
          <h3>规则防火墙</h3>
          <div className="kicker">每条原则都指向一个真实的技术实现，否则它只是标语。</div>
          {principles.map((principle) => (
            <div className="clause" key={principle.key}>
              <b>{principle.title}</b>
              {principle.body}
              <div className="mini" style={{ marginTop: 6 }}>
                怎么保证：{principle.enforced_by}
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className={verify?.ok ? 'card' : 'error'} style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>审计链校验</h3>
            <div className="kicker" style={{ marginTop: 4 }}>
              重算整条哈希链，任何一条被改写、删除或插队都会暴露。
            </div>
            {verify && (
              <>
                <div className="metric">
                  <span>状态</span>
                  <b>{verify.ok ? '完整' : '已断裂'}</b>
                </div>
                <div className="metric">
                  <span>已校验记录</span>
                  <b>{verify.checked}</b>
                </div>
                {verify.ok ? (
                  <div className="mini hash" style={{ marginTop: 8 }}>
                    链头哈希：{verify.head_hash}
                  </div>
                ) : (
                  <div className="mini" style={{ marginTop: 8 }}>
                    第 {verify.broken_at_seq} 条出问题：{verify.reason}
                  </div>
                )}
              </>
            )}
            <button
              className="btn small"
              style={{ marginTop: 12 }}
              disabled={checking}
              onClick={recheck}
            >
              重新校验
            </button>
          </div>

          <div className="card">
            <h3>商业关系披露</h3>
            <div className="kicker">ISH 与哪些作品有利益关系，全部列在这里。</div>
            {disclosures.length === 0 ? (
              <div className="mini">当前没有任何带商业关系的作品。</div>
            ) : (
              disclosures.map((item) => (
                <div className="metric" key={item.work_id}>
                  <span>{item.work_title}</span>
                  <span className="tag danger">{item.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>审计轨迹</h3>
        <div className="kicker">
          audit_events 表由数据库触发器禁止 UPDATE / DELETE / TRUNCATE，
          并且每条记录都接在上一条的哈希后面。
        </div>
        {events === null ? (
          <Loading what="审计记录" />
        ) : (
          <div className="table-scroll">
            {events.map((event) => (
              <div className="audit-row" key={event.seq}>
                <span className="mini">#{event.seq}</span>
                <span className="mini">{formatDateTime(event.created_at)}</span>
                <span>
                  <b style={{ fontSize: 12 }}>{event.action}</b>
                  <div className="mini">{event.actor_handle ? `@${event.actor_handle}` : '系统'}</div>
                </span>
                <span>
                  {event.summary}
                  <div className="hash">hash {event.hash.slice(0, 24)}… ← {event.prev_hash.slice(0, 12)}…</div>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
