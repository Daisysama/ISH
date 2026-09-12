import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentAdmin, isSiteOwner } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { ScreenedCommentDecision, CommentReportDecision, CommentAppealDecision, OwnerCommentCorrection } from '@/frontend/components/comments/CommentModerationForms'
import { COMMENT_REPORT_CATEGORIES } from '@/shared/governance-labels'

export const metadata = { title: '评论审核与举报 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminCommentsPage() {
  const admin = await getCurrentAdmin('REPORT_REVIEW')
  if (!admin) notFound()
  const [screening, reports, appeals, ownerCorrections] = await Promise.all([
    db.projectComment.findMany({ where: { status: 'PENDING', authorId: { not: admin.id },
      project: { creatorId: { not: admin.id } }, reports: { none: { reporterId: admin.id } } },
      orderBy: { createdAt: 'asc' }, take: 100, include: { project: { select: { title: true, creator: { select: { displayName: true } } } } },
    }),
    db.projectCommentReport.findMany({ where: { status: 'PENDING', reporterId: { not: admin.id },
      comment: { authorId: { not: admin.id }, project: { creatorId: { not: admin.id } },
        reports: { none: { reporterId: admin.id } } } },
      orderBy: { createdAt: 'asc' }, take: 100, include: { comment: { include: { project: { select: { title: true } } } },
        reporter: { select: { displayName: true } } },
    }),
    db.projectCommentAppeal.findMany({ where: { status: 'PENDING', appellantId: { not: admin.id },
      originalReviewerId: { not: admin.id }, reporterIdSnapshot: { not: admin.id },
      comment: { project: { creatorId: { not: admin.id } }, reports: { none: { reporterId: admin.id } } } },
      orderBy: { createdAt: 'asc' }, take: 100, include: { comment: { select: { body: true, project: { select: { title: true } } } } },
    }),
    isSiteOwner(admin.id) ? db.projectComment.findMany({ where: { status: 'HIDDEN', hiddenById: { not: admin.id },
      authorId: { not: admin.id }, project: { creatorId: { not: admin.id } }, reports: { none: { reporterId: admin.id } } },
      orderBy: { updatedAt: 'desc' }, take: 30, select: { id: true, body: true, hiddenReason: true, project: { select: { title: true } } },
    }) : Promise.resolve([]),
  ])
  return <><GlobalHeader active="governance" /><main className="moderation-shell shell-with-header">
    <Link className="page-breadcrumb" href="/admin/governance">← 网站治理</Link>
    <span className="eyebrow">COMMENT REVIEW</span><h1>评论审核与举报</h1>
    <p>先处理等待最久的内容。作者、举报人、项目发起人及原审查员按案件角色回避；自动筛查命中的原文仅网站审核员可看。</p>
    {appeals.length > 0 && <section><h2>评论下架申诉 · {appeals.length}</h2><div className="moderation-list">
      {appeals.map(item => <article className="moderation-card" key={item.id}><h3>项目「{item.comment.project.title}」</h3>
        <p>原评论：{item.comment.body}</p><p>原处理依据：{item.reasonSnapshot}</p><p>作者申诉：{item.statement}</p>
        <CommentAppealDecision id={item.id} /></article>)}
    </div></section>}
    {screening.length > 0 && <section><h2>自动暂缓评论 · {screening.length}</h2><div className="moderation-list">
      {screening.map(item => <article className="moderation-card" key={item.id}>
        <p>等待于 {item.createdAt.toLocaleString('zh-CN')} · 项目「{item.project.title}」 · 发起人：{item.project.creator.displayName}</p>
        <h3>{item.authorNameSnapshot} 的{item.parentId ? '回复' : '评论'}</h3><p className="comment-body">{item.body}</p>
        <p>等待原因：{item.screeningResult === 'CLEAR' ? '作者在举报待审时删除，恢复后须重新独立审核' :
          item.screeningResult === 'BLOCK' ? '自动筛查暂缓发布' : '自动筛查建议人工核查'}</p>
        <ScreenedCommentDecision id={item.id} />
      </article>)}
    </div></section>}
    {reports.length > 0 && <section><h2>评论举报 · {reports.length}</h2><div className="moderation-list">
      {reports.map(item => <article className="moderation-card" key={item.id}>
        <p>举报于 {item.createdAt.toLocaleString('zh-CN')} · 项目「{item.comment.project.title}」</p>
        <h3>被举报评论：{item.comment.authorNameSnapshot}</h3><p className="comment-body">原文快照：{item.bodySnapshot}</p>
        <p>举报人：{item.reporter.displayName} · 类型：{COMMENT_REPORT_CATEGORIES[item.category as keyof typeof COMMENT_REPORT_CATEGORIES] ?? '其他问题'}</p>
        <p>举报说明：{item.statement}</p><CommentReportDecision id={item.id} />
      </article>)}
    </div></section>}
    {screening.length === 0 && reports.length === 0 && appeals.length === 0 && <section className="empty-state compact-empty"><h2>目前没有您可以独立审查的评论。</h2></section>}
    {ownerCorrections.length > 0 && <section className="panel governance-panel"><h2>站主纠错</h2>{ownerCorrections.map(item => <article className="governance-rule-item" key={item.id}>
      <strong>项目「{item.project.title}」</strong><p>原评论：{item.body}</p><p>原下架理由：{item.hiddenReason}</p>
      <OwnerCommentCorrection commentId={item.id} />
    </article>)}</section>}
  </main></>
}
