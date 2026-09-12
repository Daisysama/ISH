import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { hasSitePermission } from '@/backend/auth/admin'
import { getProjectMembershipForUser } from '@/backend/memberships/queries'
import { getPreferenceLearningContext } from '@/backend/profile/preference-queries'
import { getProjectResponseForResponder } from '@/backend/responses/queries'
import { getProjectById } from '@/backend/projects/queries'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { ProjectPreferenceControls } from '@/frontend/components/projects/ProjectPreferenceControls'
import { ProjectResponsePanel } from '@/frontend/components/responses/ProjectResponsePanel'
import { ProjectStatusBadge } from '@/frontend/components/projects/ProjectStatusBadge'
import { RemovalNotice } from '@/frontend/components/memberships/RemovalNotice'
import { AppealProjectReportForm } from '@/frontend/components/governance/ProjectReportForms'
import { getProjectResponseOptions, projectAcceptsResponses } from '@/core/responses/project-response'
import { resolveProjectReturn } from '@/shared/navigation'
import { publicUserHref } from '@/shared/user-navigation'
import {
  GROUP_ACCESS_LABELS,
  PROJECT_AUDIENCE_LABELS,
  PROJECT_PURPOSE_LABELS,
  PROJECT_STAGE_LABELS,
} from '@/shared/project'

export const dynamic = 'force-dynamic'

type ProjectPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ from?: string | string[]; review?: string | string[] }>
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { id } = await params
  const project = await getProjectById(id)

  if (!project || project.status !== 'PUBLISHED') return { title: '项目 · FromISH', robots: { index: false, follow: false } }

  return {
    title: `${project.title} · FromISH`,
    description: project.summary,
    alternates: { canonical: `/projects/${project.id}` },
    openGraph: {
      title: `${project.title} · FromISH`,
      description: project.summary,
      url: `/projects/${project.id}`,
      type: 'article',
    },
  }
}

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) notFound()

  const user = await getCurrentUser()
  const blockedUsers = user ? await db.userBlock.findMany({ where: { blockerId: user.id, active: true }, select: { blockedId: true } }) : []
  const blockedUserIds = new Set(blockedUsers.map(item => item.blockedId))
  const viewerIsCreator = user?.id === project.creatorId
  const projectCases = viewerIsCreator ? await db.projectReport.findMany({
    where: { projectId: id, decision: 'UNLISTED', mergedIntoId: null }, orderBy: { reviewedAt: 'desc' },
    take: 20, select: { id: true, decisionReason: true, reviewedAt: true, reviewedBy: { select: { displayName: true } },
      appeal: { select: { status: true, decision: true, decisionReason: true } },
      events: { orderBy: { createdAt: 'asc' }, select: { id: true, action: true, note: true, createdAt: true } } },
  }) : []
  const unlisting = project.status === 'HIDDEN' ? projectCases[0] : null
  const viewerIsAdmin = user ? await hasSitePermission(user.id, 'PROJECT_REVIEW') : false
  const [preferenceContext, viewerResponse, viewerMembership] = await Promise.all([
    user && !viewerIsCreator ? getPreferenceLearningContext(user.id) : Promise.resolve(null),
    user && !viewerIsCreator ? getProjectResponseForResponder(project.id, user.id) : Promise.resolve(null),
    user && !viewerIsCreator ? getProjectMembershipForUser(project.id, user.id) : Promise.resolve(null),
  ])
  const activeMembership = viewerMembership?.status === 'ACTIVE' ? viewerMembership : null
  const viewerIsMember = Boolean(activeMembership)

  const viewerWasRemoved = viewerMembership?.status === 'REMOVED'
  const isPrivatePreview = project.status !== 'PUBLISHED'
  const from = searchParams ? await searchParams : {}
  const returnTarget = resolveProjectReturn(from.from, isPrivatePreview ? 'dashboard' : 'projects', from.review)
  if (project.status !== 'PUBLISHED' && !viewerIsCreator && !viewerIsAdmin && !viewerIsMember && !viewerWasRemoved) notFound()

  // 已移出者在非公开项目只能看到自己的移出回执，不能借历史关系重获项目内部访问。
  if (project.status !== 'PUBLISHED' && viewerWasRemoved) {
    return (
      <>
        <GlobalHeader />
        <main className="project-story-shell shell-with-header">
          <Link className="page-breadcrumb" href={returnTarget.href}>← {returnTarget.label}</Link>
          <h1>{project.title}</h1>
          <RemovalNotice
            projectId={project.id}
            removedAt={viewerMembership.leftAt}
            reason={viewerMembership.departureReason}
            actorName={viewerMembership.removedBy?.displayName ?? project.creator.displayName}
            reviews={viewerMembership.removalReviews}
          />
        </main>
      </>
    )
  }

  const responseOpen = project.status === 'PUBLISHED' && !viewerIsCreator && !viewerMembership && projectAcceptsResponses(project)
  const responseOptions = responseOpen ? getProjectResponseOptions(project) : []
  const approvedResponderCanSeeGroup = viewerIsMember && project.groupAccessMode === 'APPROVAL_REQUIRED'
  const activeRevision = project.revisions[0] ?? null

  return (
    <>
      <GlobalHeader />
      <main className="project-story-shell shell-with-header">
        <div className="project-sticky-return">
          <Link className="page-breadcrumb" href={returnTarget.href}>
            ← {returnTarget.label}
          </Link>
          <span className="project-sticky-title" title={project.title}>{project.title}</span>
        </div>

        {isPrivatePreview && (
          <div className="notice notice-private">
            <strong>这是非公开预览。</strong>
            {project.status === 'PENDING'
              ? ' 项目正在等待审核，其他普通用户无法访问。'
              : project.status === 'HIDDEN' ? ' 项目经网站核查暂时下架，普通用户暂不可见；原内容和处理记录保留。'
                : ' 项目没有通过本轮审核，其他普通用户无法访问。'}
          </div>
        )}

        {viewerWasRemoved && (
          <RemovalNotice
            projectId={project.id}
            removedAt={viewerMembership.leftAt}
            reason={viewerMembership.departureReason}
            actorName={viewerMembership.removedBy?.displayName ?? project.creator.displayName}
            reviews={viewerMembership.removalReviews}
          />
        )}

        {viewerMembership?.status === 'LEFT' && (
          <div className="notice notice-private membership-departure-notice">
            <strong>您已经退出这个项目。</strong>
            {viewerMembership.departureReason ? ` 您当时留下的说明：${viewerMembership.departureReason}` : ''}
          </div>
        )}

        {viewerIsCreator && project.status === 'PUBLISHED' && activeRevision?.status === 'PENDING' && (
          <div className="notice notice-private">
            <strong>V{activeRevision.version} 修改审核中。</strong> 您现在看到的是仍在公开的 V{project.version}；审核通过前不会被覆盖。
            {' '}<Link className="story-link" href={`/projects/${project.id}/edit`}>查看修改 →</Link>
          </div>
        )}

        {viewerIsCreator && project.status === 'PUBLISHED' && activeRevision?.status === 'REJECTED' && (
          <div className="notice notice-danger">
            <strong>V{activeRevision.version} 修改被退回。</strong> {activeRevision.rejectionReason || '请根据审核意见调整后重新提交。'}
            {' '}<Link className="story-link" href={`/projects/${project.id}/edit`}>继续修改 →</Link>
          </div>
        )}

        {project.status === 'REJECTED' && project.rejectionReason && (
          <div className="notice notice-danger"><strong>退回原因：</strong> {project.rejectionReason}</div>
        )}

        {viewerIsCreator && project.status === 'HIDDEN' && <section className="panel governance-panel" aria-label="项目下架回执">
          <h2>这个项目已暂时下架</h2>
          <p>原处理人：{unlisting?.reviewedBy?.displayName ?? '网站管理员'} · 处理于：{unlisting?.reviewedAt?.toLocaleString('zh-CN') ?? '请查看消息'}</p>
          <p>原处理依据：{unlisting?.decisionReason ?? project.rejectionReason ?? '请联系网站核查'}</p>
          <p>您的项目及已有贡献记录仍然保留，原举报人身份不会在这里展示。</p>
          {unlisting && (unlisting.appeal ? <p>独立申诉：{unlisting.appeal.status === 'PENDING' ? '等待处理' : unlisting.appeal.decision === 'RESTORED' ? '申诉成立' : '维持原决定'}
            {unlisting.appeal.decisionReason && ` · ${unlisting.appeal.decisionReason}`}</p> : <AppealProjectReportForm reportId={unlisting.id} />)}
        </section>}

        {viewerIsCreator && project.status === 'PUBLISHED' && projectCases.length > 0 && <section className="panel governance-panel">
          <h2>此前的项目治理记录</h2>
          <p>项目已重新公开；原举报审查、下架与纠正的过程仍可查阅。</p>
          {projectCases.map(item => <article key={item.id} className="governance-rule-item">
            <p>原下架于 {item.reviewedAt?.toLocaleString('zh-CN')} · 操作人：{item.reviewedBy?.displayName ?? '网站管理员'}</p>
            <p>原处理依据：{item.decisionReason}</p>
            {item.appeal?.decisionReason && <p>复核：{item.appeal.decision === 'RESTORED' ? '撤销原下架' : '维持原下架'} · {item.appeal.decisionReason}</p>}
            {item.events.filter(event => event.action === 'OWNER_RESTORED').map(event => <p key={event.id}>站主于 {event.createdAt.toLocaleString('zh-CN')} 纠正：{event.note}</p>)}
          </article>)}
        </section>}

        <article className="project-story">
          <div className="project-story-art" aria-hidden="true">
            <span className="project-story-sun" />
            <span className="project-story-line" />
            <span className="project-story-note">A thought,<br />finding its way.</span>
          </div>

          <div className="project-story-content">
            <header>
              <div className="project-story-meta">
                <span>由 <Link className="user-name-link" href={publicUserHref(project.creator.uid, `/projects/${project.id}?from=${returnTarget.href === '/dashboard' ? 'dashboard' : 'projects'}`)}>{project.creator.displayName}</Link> 发起</span>
                <span>{project.publishedAt ? `发布于 ${project.publishedAt.toLocaleDateString('zh-CN')}` : `提交于 ${project.submittedAt.toLocaleDateString('zh-CN')}`}</span>
                {isPrivatePreview && <ProjectStatusBadge status={project.status} />}
              </div>
              <h1>{project.title}</h1>
              <p className="project-lead">{project.summary}</p>
              {project.status === 'PUBLISHED' && preferenceContext && (
                <ProjectPreferenceControls
                  projectId={project.id}
                  projectTags={project.typeTags}
                  likedTags={preferenceContext.likeTags}
                  dislikedTags={preferenceContext.dislikeTags}
                  suppressInterestedPrompt={preferenceContext.suppressInterestedPrompt}
                  suppressNotInterestedPrompt={preferenceContext.suppressNotInterestedPrompt}
                  initialKind={preferenceContext.projectPreferences.find(item => item.projectId === project.id)?.kind ?? null}
                  initialHidden={preferenceContext.hiddenProjectIds.includes(project.id)}
                  initialFavorited={preferenceContext.favoriteProjectIds.includes(project.id)}
                />
              )}
              {project.status === 'PUBLISHED' && !viewerIsCreator &&
                <p><Link className="story-link" href={`/projects/${project.id}/report`}>举报这个项目 →</Link></p>}
            </header>

            <section className="project-facts-grid">
              <div><span>现在走到哪里</span><strong>{PROJECT_STAGE_LABELS[project.stage]}</strong></div>
              <div><span>这声咩想干嘛</span><strong>{PROJECT_PURPOSE_LABELS[project.purpose]}</strong></div>
              <div><span>主要想让谁听见</span><strong>{PROJECT_AUDIENCE_LABELS[project.audience]}</strong></div>
              <div>
                <span>同行者</span>
                <div className="project-member-fact">
                  <strong>{project.memberships.length} 位</strong>
                  {(viewerIsCreator || viewerIsMember) && (
                    <Link className="story-link" href={`/projects/${project.id}/team`}>
                      {viewerIsCreator ? '管理同行者 →' : '查看同行者 →'}
                    </Link>
                  )}
                </div>
              </div>
              <div><span>咩咩啊？</span><div className="tag-row">{project.typeTags.map((tag) => <span className="tag-chip" key={tag}>{tag}</span>)}</div></div>
              <div><span>想找什么样的羊</span><div className="tag-row">{project.seekingTags.length > 0 ? project.seekingTags.map((tag) => <span className="tag-chip tag-chip-green" key={tag}>{tag}</span>) : <em>暂不招募</em>}</div></div>
              <div><span>目标平台</span><div className="tag-row">{project.platforms.length > 0 ? project.platforms.map((tag) => <span className="tag-chip" key={tag}>{tag}</span>) : <em>还没定</em>}</div></div>
            </section>

            {activeMembership && (
              <section className="project-membership-card">
                <div>
                  <span className="eyebrow">同行中</span>
                  <h2>您已经是这个项目的同行者。</h2>
                  <p>同行身份：{activeMembership.roles.length ? activeMembership.roles.join(' · ') : '同行者'}。当前项目资料为只读；后续编辑权限由项目发起人主动授予。</p>
                  {activeMembership.removalRecords.length > 0 && (
                    <Link className="story-link" href={`/projects/${project.id}/removal-review`}>查看此前移出记录及申诉 →</Link>
                  )}
                </div>
              </section>
            )}

            {responseOpen && (
              <ProjectResponsePanel
                projectId={project.id}
                options={responseOptions}
                loggedIn={Boolean(user)}
                existingResponse={viewerResponse}
                approvalGroupUnlocked={approvedResponderCanSeeGroup}
              />
            )}

            {project.description && (
              <section className="project-description">
                <span className="eyebrow">还有什么想告诉羊群的吗？</span>
                <div className="prose-text">{project.description}</div>
              </section>
            )}

            {project.externalUrl && (
              <section className="project-external-link">
                <a className="button button-primary" href={project.externalUrl} target="_blank" rel="noreferrer">去看看作品 ↗</a>
              </section>
            )}

            {project.groupAccessMode === 'PUBLIC' && project.groupContact && (
              <section className="public-group-card">
                <strong>一起聊聊 · {GROUP_ACCESS_LABELS.PUBLIC}</strong>
                <p>{project.groupType || '群聊'}：{project.groupContact}</p>
              </section>
            )}

            {(viewerIsCreator || viewerIsAdmin || approvedResponderCanSeeGroup) && project.groupAccessMode !== 'PUBLIC' && (project.groupType || project.groupContact) && (
              <section className="private-info-card">
                <strong>群聊信息 · {GROUP_ACCESS_LABELS[project.groupAccessMode]}</strong>
                <p>{project.groupType || '群聊'}：{project.groupContact || '未填写联系方式'}</p>
                {approvedResponderCanSeeGroup && <p>创作者已经接受您的响应，这份申请制群聊信息现在只对您解锁。</p>}
                {(viewerIsCreator || viewerIsAdmin) && <p>{project.allowIshJoinGroup ? '您已邀请 ISH 加入群聊，陪伴项目成长。' : '目前没有邀请 ISH 加入群聊。'}</p>}
              </section>
            )}
          </div>
        </article>

        {project.status === 'PUBLISHED' && (
          <section className="panel update-public-list project-update-preview" id="project-updates">
            <div className="section-title-row">
              <div><span className="eyebrow">PROJECT UPDATES</span><h2>项目动态</h2></div>
              <Link className="story-link" href={`/projects/${project.id}/updates?from=detail&projectFrom=${returnTarget.href === '/dashboard' ? 'dashboard' : 'projects'}`}>查看时间线 →</Link>
            </div>
            {project.updates.length === 0 ? <p>还没有公开动态，之后的进展会按时间留在这里。</p> : (
              <div className="update-timeline">
                {project.updates.map(item => (
                  <article className="update-timeline-item" key={item.id}>
                    {item.authorId && blockedUserIds.has(item.authorId) ? <p>已拉黑作者，这条动态暂不展示；您可以到个人拉黑名单解除。</p> : <>
                    <time dateTime={item.publishedAt?.toISOString()}>{item.publishedAt?.toLocaleString('zh-CN')}</time>
                    <h3>{item.title}</h3>
                    <p className="update-meta">由 {item.authorNameSnapshot} 发布</p>
                    <p className="update-body">{item.body}</p>
                    <Link className="story-link" href={`/projects/${project.id}/discussion?update=${item.id}`}>评论与回复 →</Link>
                    </>}
                  </article>
                ))}
              </div>
            )}
            {(viewerIsCreator || activeMembership?.permissions.includes('SUBMIT_UPDATES')) && (
              <Link className="button button-quiet button-compact" href={`/projects/${project.id}/updates/new?from=detail&projectFrom=${returnTarget.href === '/dashboard' ? 'dashboard' : 'projects'}`}>发一条动态 →</Link>
            )}
          </section>
        )}

        {project.status === 'PUBLISHED' && <section className="panel governance-panel comment-entry" id="project-discussion">
          <span className="eyebrow">PROJECT CONVERSATION</span><h2>聊聊这个项目</h2>
          <p>每条动态有自己的讨论区；这里适合交流对项目整体的看法。评论与回复支持点赞、点踩、私人屏蔽和向网站举报。</p>
          <Link className="button button-primary button-compact" href={`/projects/${project.id}/discussion?from=${returnTarget.href === '/dashboard' ? 'dashboard' : 'projects'}`}>进入项目讨论 →</Link>
        </section>}

        {(viewerIsCreator || viewerIsAdmin) && project.moderationEvents.length > 0 && (
          <section className="panel audit-panel">
            <div className="section-title-row audit-title-row">
              <div><span className="eyebrow">TRACE</span><h2>审核记录</h2></div>
              <p>治理动作留痕，之后才知道项目是怎么走到这里的。</p>
            </div>
            <div className="audit-list">
              {project.moderationEvents.map((event) => (
                <div className="audit-item" key={event.id}>
                  <strong>{event.reviewType === 'UPDATE' ? `V${event.revision?.version ?? '?'} 修改${event.action === 'APPROVED' ? '通过' : '退回'}` : (event.action === 'APPROVED' ? '首次审核通过' : '首次审核退回')}</strong>
                  <time dateTime={event.createdAt.toISOString()}>{event.createdAt.toLocaleString('zh-CN')}</time>
                  {event.note && <p>{event.note}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  )
}
