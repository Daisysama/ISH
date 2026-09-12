import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getCurrentAdmin } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { formatWaitingTime } from '@/core/governance/waiting-time'
import { getProjectRevisionChanges } from '@/core/meow/revision'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { ModerationPanel } from '@/frontend/components/moderation/ModerationPanel'
import { RevisionModerationPanel } from '@/frontend/components/moderation/RevisionModerationPanel'
import { ProjectUpdateReviewForm } from '@/frontend/components/updates/ProjectUpdateReviewForm'
import { projectHref } from '@/shared/navigation'
import {
  GROUP_ACCESS_LABELS, PROJECT_AUDIENCE_LABELS, PROJECT_PURPOSE_LABELS, PROJECT_STAGE_LABELS,
} from '@/shared/project'

export const metadata = { title: '项目审核 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

type ModerationSearchParams = Promise<{ sort?: string | string[]; kind?: string | string[] }>

export default async function ModerationPage({ searchParams }: { searchParams?: ModerationSearchParams }) {
  const admin = await getCurrentAdmin('PROJECT_REVIEW')
  if (!admin) notFound()
  const options = searchParams ? await searchParams : {}
  const rawSort = Array.isArray(options.sort) ? options.sort[0] : options.sort
  const rawKind = Array.isArray(options.kind) ? options.kind[0] : options.kind
  const sort = rawSort === 'newest' ? 'newest' : 'oldest'
  const kind = rawKind === 'INITIAL' || rawKind === 'REVISION' || rawKind === 'UPDATE' ? rawKind : 'ALL'

  const [projects, revisions, updates] = await Promise.all([
    db.project.findMany({
      where: { status: 'PENDING' },
      orderBy: { submittedAt: 'asc' },
      include: { creator: { select: { displayName: true, email: true } } },
    }),
    db.projectRevision.findMany({
      where: { status: 'PENDING' }, orderBy: { submittedAt: 'asc' },
      include: { project: { include: { creator: { select: { displayName: true, email: true } } } } },
    }),
    db.projectUpdate.findMany({
      where: { status: 'PENDING' }, orderBy: { submittedAt: 'asc' },
      include: {
        project: { select: { id: true, title: true, status: true, creatorId: true } },
        events: { where: { type: 'REOPENED' }, select: { actorUserId: true, previousReviewerIdSnapshot: true } },
      },
    }),
  ])

  const queue = [
    ...projects.map(project => ({ kind: 'INITIAL' as const, id: project.id, at: project.submittedAt, project })),
    ...revisions.map(revision => ({ kind: 'REVISION' as const, id: revision.id, at: revision.submittedAt, revision })),
    ...updates.map(update => ({ kind: 'UPDATE' as const, id: update.id, at: update.submittedAt, update })),
  ].filter(item => kind === 'ALL' || item.kind === kind)
    .sort((a, b) => (a.at.getTime() - b.at.getTime()) * (sort === 'oldest' ? 1 : -1) || a.id.localeCompare(b.id))
  const now = new Date()
  const total = projects.length + revisions.length + updates.length

  return (
    <>
      <GlobalHeader active="moderation" />
      <main className="moderation-shell shell-with-header">
        <div className="moderation-heading">
          <div><span className="eyebrow">MODERATION</span><h1>项目审核</h1>
            <p>首次发布、修改再审与项目动态汇入一条队列。按提交时间显示等待多久；审核通过前，动态不会公开。</p></div>
          <span className="moderation-count">{total} 条待处理</span>
        </div>
        <form className="moderation-order-form" method="get">
          <label>事项类型
            <select name="kind" defaultValue={kind}>
              <option value="ALL">全部 · {total}</option>
              <option value="INITIAL">项目首次发布 · {projects.length}</option>
              <option value="REVISION">项目修改再审 · {revisions.length}</option>
              <option value="UPDATE">项目动态 · {updates.length}</option>
            </select>
          </label>
          <label>等待时间排序
            <select name="sort" defaultValue={sort}>
              <option value="oldest">等待最久优先</option>
              <option value="newest">最近提交优先</option>
            </select>
          </label>
          <button className="button button-quiet button-compact" type="submit">应用</button>
        </form>
        <div className="moderation-list moderation-unified-list">
          {queue.length === 0 && <section className="empty-state compact-empty"><h2>当前筛选下没有待审核内容。</h2></section>}
          {queue.map(item => {
            const waiting = formatWaitingTime(item.at, now)
            if (item.kind === 'INITIAL') {
              const project = item.project
              return (
                <article className="moderation-card" key={`initial:${item.id}`}>
                  <div className="project-card-meta"><span>项目首次发布</span><span className="moderation-waiting">{waiting}</span><time dateTime={item.at.toISOString()}>{item.at.toLocaleString('zh-CN')} 提交</time></div>
                  <h2>{project.title}</h2><p>发起人：{project.creator.displayName}</p><p className="project-lead">{project.summary}</p>
                  <div className="moderation-facts">
                    <div><strong>阶段</strong><span>{PROJECT_STAGE_LABELS[project.stage]}</span></div>
                    <div><strong>目的</strong><span>{PROJECT_PURPOSE_LABELS[project.purpose]}</span></div>
                    <div><strong>受众</strong><span>{PROJECT_AUDIENCE_LABELS[project.audience]}</span></div>
                    <div><strong>类型</strong><span>{project.typeTags.join(' · ') || '未填写'}</span></div>
                    <div><strong>寻找</strong><span>{project.seekingTags.join(' · ') || '暂不招募'}</span></div>
                    <div><strong>平台</strong><span>{project.platforms.join(' · ') || '未指定'}</span></div>
                  </div>
                  {project.description && <div className="prose-text moderation-description">{project.description}</div>}
                  {project.externalUrl && <p><a className="story-link" href={project.externalUrl} target="_blank" rel="noreferrer">查看现有作品 ↗</a></p>}
                  {(project.groupType || project.groupContact) && <div className="private-info-card">
                    <strong>群聊信息 · {GROUP_ACCESS_LABELS[project.groupAccessMode]}</strong>
                    <p>{project.groupType || '群聊'}：{project.groupContact || '未填写联系方式'}</p>
                    <p>{project.allowIshJoinGroup ? '创作者欢迎 ISH 加入群聊陪伴项目成长。' : '创作者暂未邀请 ISH 加入群聊。'}</p>
                  </div>}
                  <p><Link className="story-link" href={projectHref(project.id, 'moderation')}>打开非公开项目页 →</Link></p>
                  <ModerationPanel projectId={project.id} />
                </article>
              )
            }
            if (item.kind === 'REVISION') {
              const revision = item.revision
              const project = revision.project
              const changes = getProjectRevisionChanges(project, revision)
              return (
                <article className="moderation-card moderation-revision-card" key={`revision:${item.id}`}>
                  <div className="project-card-meta"><span>修改再审</span><span className="moderation-waiting">{waiting}</span><time dateTime={item.at.toISOString()}>{item.at.toLocaleString('zh-CN')} 提交</time></div>
                  <div className="revision-review-title-row"><div><span className="eyebrow">线上 V{project.version} → 待审 V{revision.version}</span><h2>{revision.title}</h2></div>
                    <Link className="story-link" href={projectHref(project.id, 'moderation')}>看当前线上版 →</Link></div>
                  <p>发起人：{project.creator.displayName}</p>
                  {changes.length === 0 ? <p className="revision-no-change">这次提交没有检测到可见字段变化。</p> : (
                    <div className="revision-diff-list">{changes.map(change => <div className="revision-diff-row" key={change.key}>
                      <strong>{change.label}</strong>
                      <div className="revision-diff-side revision-diff-before"><span>线上 V{project.version}</span><p>{change.before}</p></div>
                      <div className="revision-diff-side revision-diff-after"><span>待审 V{revision.version}</span><p>{change.after}</p></div>
                    </div>)}</div>
                  )}
                  <RevisionModerationPanel revisionId={revision.id} />
                </article>
              )
            }
            const update = item.update
            const conflict = admin.id === update.authorId || admin.id === update.project.creatorId ||
              update.events.some(event => event.actorUserId === admin.id || event.previousReviewerIdSnapshot === admin.id)
            return (
              <article className="moderation-card update-moderation-card" key={`update:${item.id}`}>
                <div className="project-card-meta"><span>项目动态</span><span className="moderation-waiting">{waiting}</span><time dateTime={item.at.toISOString()}>{item.at.toLocaleString('zh-CN')} 提交</time></div>
                <h2>{update.title}</h2>
                <p>项目：{update.project.title} · 作者：{update.authorNameSnapshot}</p>
                <p className="update-body">{update.body}</p>
                <p><Link className="story-link" href={`/admin/updates/${update.id}`}>查看这条动态及审核记录 →</Link></p>
                {conflict ? <p className="notice notice-danger">您与此项目或动态有关，请交由另一位管理员审核。</p> : <ProjectUpdateReviewForm updateId={update.id} />}
              </article>
            )
          })}
        </div>
      </main>
    </>
  )
}
