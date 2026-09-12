import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { getResponseCenterCounts, listIncomingResponsesForCreator, listOutgoingResponsesForUser } from '@/backend/responses/queries'
import { ResponseCenterSeenMarker } from '@/frontend/components/responses/ResponseCenterSeenMarker'
import { OneTimeNewBadge } from '@/frontend/components/responses/OneTimeNewBadge'
import { ResponseDecisionCard } from '@/frontend/components/responses/ResponseDecisionCard'
import { CollaborationProfile } from '@/frontend/components/profile/CollaborationProfile'
import { projectHref } from '@/shared/navigation'
import { PROJECT_RESPONSE_STATUS_LABELS } from '@/shared/project-response'

export const metadata = { title: '咩的回应 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ResponsesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [incoming, outgoing, responseCounts] = await Promise.all([
    listIncomingResponsesForCreator(user.id),
    listOutgoingResponsesForUser(user.id),
    getResponseCenterCounts(user.id),
  ])

  return (
    <div className="dashboard-stack response-center">
      <ResponseCenterSeenMarker shouldMark={responseCounts.unreadOutgoing > 0} />
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">MEOWS ANSWERED</span>
          <h1>听听羊群回了什么。</h1>
          <p>这里既有别人回应您的咩，也有您发给其他项目的回应。{responseCounts.total > 0 ? ` 目前有 ${responseCounts.total} 条需要您留意。` : ''}</p>
        </div>
        <Link className="button button-quiet" href="/dashboard">← 我的项目</Link>
      </section>

      <section>
        <div className="section-title-row dashboard-section-title"><div><span className="eyebrow">回应我的咩{responseCounts.pendingIncoming > 0 ? ` · ${responseCounts.pendingIncoming} 待回应` : ''}</span><h2>有人愿意走近一点。</h2></div></div>
        {incoming.length === 0 ? <div className="empty-state compact-empty"><h3>暂时还没有新的回应。</h3><p>项目被更多合适的人看到以后，这里会慢慢热闹起来。</p></div> : (
          <div className="response-list">
            {incoming.map(response => (
              <article className="response-card" key={response.id} id={`response-${response.id}`}>
                <div className="response-card-top"><div><Link className="story-link" href={projectHref(response.project.id, 'responses')}>{response.project.title}</Link><h3>{response.responder.displayName} · UID {response.responder.uid} 回了一声咩</h3></div><ResponseDecisionCard responseId={response.id} status={response.status} /></div>
                <div className="tag-row">{response.roles.map(role => <span className="tag-chip tag-chip-green" key={role}>{role}</span>)}</div>
                {response.message && <blockquote className="response-message">{response.message}</blockquote>}
                {(response.status === 'PENDING' || (response.status === 'APPROVED' && response.membership?.status === 'ACTIVE')) &&
                  <CollaborationProfile user={response.responder} currentProjectId={response.project.id} returnTo="/dashboard/responses" />}
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="section-title-row dashboard-section-title"><div><span className="eyebrow">我发出的回应{responseCounts.unreadOutgoing > 0 ? ` · ${responseCounts.unreadOutgoing} 个新结果` : ''}</span><h2>您也在成为别人的同行者。</h2></div></div>
        {outgoing.length === 0 ? <div className="empty-state compact-empty"><h3>您还没有响应过其他项目。</h3><p>去羊群广场走走，也许正好有人在找您会的东西。</p><Link className="story-link" href="/projects">去羊群广场 →</Link></div> : (
          <div className="response-list response-list-outgoing">
            {outgoing.map(response => (
              <article className="response-card" key={response.id}>
                <div className="response-card-top">
                  <div>
                    <div className="response-result-heading">
                      <Link className="story-link" href={projectHref(response.project.id, 'responses')}>{response.project.title}</Link>
                      <OneTimeNewBadge
                        show={(response.status === 'APPROVED' || response.status === 'REJECTED') && !response.responderDecisionSeenAt}
                      />
                    </div>
                    <h3>{PROJECT_RESPONSE_STATUS_LABELS[response.status]}</h3>
                  </div>
                  <time>{response.updatedAt.toLocaleString('zh-CN')}</time>
                </div>
                <div className="tag-row">{response.roles.map(role => <span className="tag-chip" key={role}>{role}</span>)}</div>
                {response.message && <p>{response.message}</p>}
                {response.status === 'APPROVED' && response.project.groupAccessMode === 'APPROVAL_REQUIRED' && response.project.groupContact && <div className="public-group-card"><strong>创作者已经接受您的响应</strong><p>{response.project.groupType || '群聊'}：{response.project.groupContact}</p></div>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
