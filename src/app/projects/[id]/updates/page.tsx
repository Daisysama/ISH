import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'

import { getCurrentUser } from '@/backend/auth/current-user'
import { getProjectUpdatePageState } from '@/backend/updates/queries'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { AutomaticReviewRequestForm } from '@/frontend/components/updates/AutomaticReviewRequestForm'
import { UserBlockForm } from '@/frontend/components/blocks/UserBlockForm'
import { RequestHiddenUpdateAppealForm } from '@/frontend/components/governance/HiddenUpdateAppealForms'

export const metadata = { title: '项目动态 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ProjectUpdatesPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string | string[]; projectFrom?: string | string[]; submitted?: string | string[]; focus?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const user = await getCurrentUser()
  const focus = z.string().uuid().safeParse(query.focus)
  const project = await getProjectUpdatePageState(id, user?.id, focus.success ? focus.data : undefined)
  if (!project || (project.status !== 'PUBLISHED' && !project.isCreator)) notFound()
  const from = Array.isArray(query.from) ? query.from[0] : query.from
  const rawProjectFrom = Array.isArray(query.projectFrom) ? query.projectFrom[0] : query.projectFrom
  const projectFrom = rawProjectFrom === 'dashboard' ? 'dashboard' : 'projects'
  const returnTarget = from === 'dashboard' ? { href: '/dashboard', label: '我的项目' }
    : from === 'notifications' ? { href: '/notifications', label: '消息提醒' }
      : { href: `/projects/${id}?from=${projectFrom}`, label: '项目详情' }
  const submitted = (Array.isArray(query.submitted) ? query.submitted[0] : query.submitted) === '1'
  return (
    <>
      <GlobalHeader active={returnTarget.href === '/dashboard' ? 'projects' : undefined} />
      <main className="team-page-shell shell-with-header update-page">
        <Link className="page-breadcrumb" href={returnTarget.href}>← {returnTarget.label}</Link>
        <div className="team-page-heading">
          <div><span className="eyebrow">PROJECT TIMELINE</span><h1>「{project.title}」的动态</h1><p>只有审核通过的动态会出现在公开时间线。对外进展与项目内部协作记录分开保存。</p></div>
          {project.canSubmit && <Link className="button button-primary button-compact" href={`/projects/${id}/updates/new?from=timeline&timelineFrom=${from === 'dashboard' || from === 'notifications' ? from : 'detail'}&projectFrom=${projectFrom}`}>发动态 →</Link>}
        </div>
        {submitted && <p className="notice notice-success" role="status">已送去网站审核。通过前只有您、项目发起人与负责审核的网站管理员能看到这条动态。</p>}
        {(Array.isArray(query.submitted) ? query.submitted[0] : query.submitted) === 'published' && <p className="notice notice-success" role="status">动态未命中现行规则，已依站主设置自动公开。其他用户仍可举报问题内容。</p>}
        {(Array.isArray(query.submitted) ? query.submitted[0] : query.submitted) === 'blocked' && <p className="notice notice-danger" role="status">系统暂缓了这条动态的发布。您可以在下方查看原稿、修改后重投，或申请人工复核。</p>}
        {project.ownUnpublished.length > 0 && (
          <section className="panel update-own-list">
            <h2>{project.isCreator ? '项目待审与退回动态' : '我提交的待审与退回动态'}</h2>
            <p>这些内容尚未公开，退回原因会一直保留。</p>
            <div className="update-timeline">
              {project.ownUnpublished.map(item => (
                <article className="update-timeline-item" key={item.id} id={`update-${item.id}`}>
                  <span className={item.status === 'PENDING' ? 'history-status' : 'history-status history-status-removed'}>{item.status === 'PENDING' ? '等待审核' : item.status === 'HIDDEN' ? '经网站审查暂时下架' : '已退回'}</span>
                  <h3>{item.title}</h3>
                  <p className="update-meta">{item.authorNameSnapshot} · 提交于 {item.submittedAt.toLocaleString('zh-CN')}</p>
                  <p className="update-body">{item.body}</p>
                  {item.rejectionReason && <p className="rejection-preview">退回原因：{item.rejectionReason}</p>}
                  {item.status === 'REJECTED' && item.scan?.result === 'BLOCK' && item.authorId === user?.id && <AutomaticReviewRequestForm updateId={item.id} />}
                  {item.status === 'HIDDEN' && item.authorId === user?.id && (item.hiddenAppeals[0] ?
                    <p>网站复核：{item.hiddenAppeals[0].status === 'PENDING' ? '审查中' : item.hiddenAppeals[0].decision === 'UPHELD' ? '维持下架' : '原下架决定已撤销'}
                      {item.hiddenAppeals[0].decisionReason && ` · ${item.hiddenAppeals[0].decisionReason}`}</p> :
                    <RequestHiddenUpdateAppealForm updateId={item.id} />)}
                  {item.status === 'REJECTED' && item.authorId === user?.id && project.canSubmit &&
                    <Link className="story-link" href={`/projects/${id}/updates/new?from=timeline&timelineFrom=${from === 'dashboard' || from === 'notifications' ? from : 'detail'}&projectFrom=${projectFrom}&revise=${item.id}`}>
                      根据退回内容重新写一条 →
                    </Link>}
                </article>
              ))}
            </div>
          </section>
        )}
        <section className="panel update-public-list">
          <div className="section-title-row"><div><span className="eyebrow">PUBLIC UPDATES</span><h2>公开时间线</h2></div><p>最近 50 条{focus.success ? ' · 含您从消息打开的动态' : ''}</p></div>
          {project.published.length === 0 ? <div className="empty-state compact-empty"><h3>还没有公开动态。</h3><p>第一条审核通过后，就会出现在这里。</p></div> : (
            <div className="update-timeline">
              {project.published.map(item => (
                <article className="update-timeline-item" key={item.id} id={`update-${item.id}`}>
                  {item.authorId && project.blockedUserIds.includes(item.authorId) ? <>
                    <p>您已拉黑此动态的作者，这条动态已折叠。需要核查历史内容时可解除拉黑。</p>
                    <UserBlockForm targetUserId={item.authorId} active />
                  </> : <>
                  <time dateTime={item.publishedAt?.toISOString()}>{item.publishedAt?.toLocaleString('zh-CN')}</time>
                  <h3>{item.title}</h3>
                  <p className="update-meta">由 {item.authorNameSnapshot} 发布</p>
                  <p className="update-body">{item.body}</p>
                  <Link className="story-link" href={`/projects/${id}/discussion?update=${item.id}`}>评论与回复 →</Link>
                  {user && item.authorId && user.id !== item.authorId && user.id !== project.creatorId &&
                    <UserBlockForm targetUserId={item.authorId} active={false} />}
                  {user && user.id !== item.authorId && user.id !== project.creatorId &&
                    <Link className="story-link" href={`/projects/${id}/updates/${item.id}/report?from=${from === 'dashboard' || from === 'notifications' ? from : 'detail'}&projectFrom=${projectFrom}`}>
                      举报这条动态 →
                    </Link>}
                  </>}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  )
}
