import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getCurrentAdmin } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { ModerationPanel } from '@/frontend/components/moderation/ModerationPanel'
import {
  GROUP_ACCESS_LABELS,
  PROJECT_AUDIENCE_LABELS,
  PROJECT_PURPOSE_LABELS,
  PROJECT_STAGE_LABELS,
} from '@/shared/project'

export const metadata = { title: '项目审核 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ModerationPage() {
  const admin = await getCurrentAdmin()
  if (!admin) notFound()

  const projects = await db.project.findMany({
    where: { status: 'PENDING' },
    orderBy: { submittedAt: 'asc' },
    include: {
      creator: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
  })

  return (
    <>
      <GlobalHeader active="moderation" />
      <main className="moderation-shell shell-with-header">
        <Link className="page-breadcrumb" href="/dashboard">← 我的项目</Link>

        <div className="moderation-heading">
          <div>
            <span className="eyebrow">MODERATION</span>
            <h1>待审核的咩</h1>
            <p>审核规则可以克制，但信息必须完整：通过即公开；退回留下可执行的理由。</p>
          </div>
          <span className="moderation-count">{projects.length} 条待处理</span>
        </div>

        {projects.length === 0 ? (
          <section className="empty-state">
            <h2>审核队列为空。</h2>
            <p>今天暂时没有需要处理的新项目。</p>
          </section>
        ) : (
          <section className="moderation-list">
            {projects.map((project) => (
              <article className="moderation-card" key={project.id}>
                <div className="project-card-meta">
                  <span>{project.creator.displayName}</span>
                  <span>{project.creator.email}</span>
                  <time dateTime={project.submittedAt.toISOString()}>
                    {project.submittedAt.toLocaleString('zh-CN')}
                  </time>
                </div>

                <h2>{project.title}</h2>
                <p className="project-lead">{project.summary}</p>

                <div className="moderation-facts">
                  <div><strong>阶段</strong><span>{PROJECT_STAGE_LABELS[project.stage]}</span></div>
                  <div><strong>目的</strong><span>{PROJECT_PURPOSE_LABELS[project.purpose]}</span></div>
                  <div><strong>受众</strong><span>{PROJECT_AUDIENCE_LABELS[project.audience]}</span></div>
                  <div><strong>类型</strong><span>{project.typeTags.join(' · ') || '未填写'}</span></div>
                  <div><strong>寻找</strong><span>{project.seekingTags.join(' · ') || '暂不招募'}</span></div>
                  <div><strong>平台</strong><span>{project.platforms.join(' · ') || '未指定'}</span></div>
                </div>

                {project.description && (
                  <div className="prose-text moderation-description">{project.description}</div>
                )}

                {project.externalUrl && (
                  <p><a className="story-link" href={project.externalUrl} target="_blank" rel="noreferrer">查看现有作品 ↗</a></p>
                )}

                {(project.groupType || project.groupContact) && (
                  <div className="private-info-card">
                    <strong>群聊信息 · {GROUP_ACCESS_LABELS[project.groupAccessMode]}</strong>
                    <p>{project.groupType || '群聊'}：{project.groupContact || '未填写联系方式'}</p>
                    <p>{project.allowIshJoinGroup ? '创作者欢迎 ISH 加入群聊陪伴项目成长。' : '创作者暂未邀请 ISH 加入群聊。'}</p>
                  </div>
                )}

                <p>
                  <Link className="story-link" href={`/projects/${project.id}`}>
                    打开非公开项目页 <span aria-hidden="true">→</span>
                  </Link>
                </p>
                <ModerationPanel projectId={project.id} />
              </article>
            ))}
          </section>
        )}
      </main>
    </>
  )
}
