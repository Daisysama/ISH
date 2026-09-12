import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { isAdminEmail } from '@/backend/auth/admin'
import { getProjectById } from '@/backend/projects/queries'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { ProjectStatusBadge } from '@/frontend/components/projects/ProjectStatusBadge'
import {
  GROUP_ACCESS_LABELS,
  PROJECT_AUDIENCE_LABELS,
  PROJECT_PURPOSE_LABELS,
  PROJECT_STAGE_LABELS,
} from '@/shared/project'

export const dynamic = 'force-dynamic'

type ProjectPageProps = { params: Promise<{ id: string }> }

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

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) notFound()

  const user = await getCurrentUser()
  const viewerIsCreator = user?.id === project.creatorId
  const viewerIsAdmin = user ? isAdminEmail(user.email) : false

  if (project.status !== 'PUBLISHED' && !viewerIsCreator && !viewerIsAdmin) notFound()

  const isPrivatePreview = project.status !== 'PUBLISHED'

  return (
    <>
      <GlobalHeader />
      <main className="project-story-shell shell-with-header">
        <Link className="page-breadcrumb" href={isPrivatePreview ? '/dashboard' : '/projects'}>
          ← {isPrivatePreview ? '我的项目' : '羊群广场'}
        </Link>

        {isPrivatePreview && (
          <div className="notice notice-private">
            <strong>这是非公开预览。</strong>
            {project.status === 'PENDING'
              ? ' 项目正在等待审核，其他普通用户无法访问。'
              : ' 项目没有通过本轮审核，其他普通用户无法访问。'}
          </div>
        )}

        {project.status === 'REJECTED' && project.rejectionReason && (
          <div className="notice notice-danger"><strong>退回原因：</strong> {project.rejectionReason}</div>
        )}

        <article className="project-story">
          <div className="project-story-art" aria-hidden="true">
            <span className="project-story-sun" />
            <span className="project-story-line" />
            <span className="project-story-note">A thought,<br />finding its way.</span>
          </div>

          <div className="project-story-content">
            <header>
              <div className="project-story-meta">
                <span>由 {project.creator.displayName} 发起</span>
                <span>{project.publishedAt ? `发布于 ${project.publishedAt.toLocaleDateString('zh-CN')}` : `提交于 ${project.submittedAt.toLocaleDateString('zh-CN')}`}</span>
                {isPrivatePreview && <ProjectStatusBadge status={project.status} />}
              </div>
              <h1>{project.title}</h1>
              <p className="project-lead">{project.summary}</p>
            </header>

            <section className="project-facts-grid">
              <div><span>现在走到哪里</span><strong>{PROJECT_STAGE_LABELS[project.stage]}</strong></div>
              <div><span>这声咩想干嘛</span><strong>{PROJECT_PURPOSE_LABELS[project.purpose]}</strong></div>
              <div><span>主要想让谁听见</span><strong>{PROJECT_AUDIENCE_LABELS[project.audience]}</strong></div>
              <div><span>咩咩啊？</span><div className="tag-row">{project.typeTags.map((tag) => <span className="tag-chip" key={tag}>{tag}</span>)}</div></div>
              <div><span>想找什么样的羊</span><div className="tag-row">{project.seekingTags.length > 0 ? project.seekingTags.map((tag) => <span className="tag-chip tag-chip-green" key={tag}>{tag}</span>) : <em>暂不招募</em>}</div></div>
              <div><span>目标平台</span><div className="tag-row">{project.platforms.length > 0 ? project.platforms.map((tag) => <span className="tag-chip" key={tag}>{tag}</span>) : <em>还没定</em>}</div></div>
            </section>

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

            {(viewerIsCreator || viewerIsAdmin) && project.groupAccessMode !== 'PUBLIC' && (project.groupType || project.groupContact) && (
              <section className="private-info-card">
                <strong>群聊信息 · {GROUP_ACCESS_LABELS[project.groupAccessMode]}</strong>
                <p>{project.groupType || '群聊'}：{project.groupContact || '未填写联系方式'}</p>
                {project.groupAccessMode === 'APPROVAL_REQUIRED' && <p>同行申请功能将在下一阶段开放；目前不会向普通用户展示群聊信息。</p>}
                <p>{project.allowIshJoinGroup ? '你已邀请 ISH 加入群聊，陪伴项目成长。' : '目前没有邀请 ISH 加入群聊。'}</p>
              </section>
            )}
          </div>
        </article>

        {(viewerIsCreator || viewerIsAdmin) && project.moderationEvents.length > 0 && (
          <section className="panel audit-panel">
            <div className="section-title-row audit-title-row">
              <div><span className="eyebrow">TRACE</span><h2>审核记录</h2></div>
              <p>治理动作留痕，之后才知道项目是怎么走到这里的。</p>
            </div>
            <div className="audit-list">
              {project.moderationEvents.map((event) => (
                <div className="audit-item" key={event.id}>
                  <strong>{event.action === 'APPROVED' ? '审核通过' : '退回修改'}</strong>
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
