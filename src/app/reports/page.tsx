import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { WithdrawCommentReportForm } from '@/frontend/components/comments/CommentThread'
import { COMMENT_REPORT_CATEGORIES } from '@/shared/governance-labels'

export const metadata = { title: '我的内容举报 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function MyReportsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const [reports, projects, comments] = await Promise.all([db.projectUpdateReport.findMany({ where: { reporterId: user.id },
    orderBy: { createdAt: 'desc' }, take: 100, select: {
      id: true, titleSnapshot: true, status: true, decision: true, decisionReason: true, createdAt: true,
      update: { select: { status: true } },
    } }), db.projectReport.findMany({ where: { reporterId: user.id }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, titleSnapshot: true, status: true, decision: true, decisionReason: true, createdAt: true,
        project: { select: { status: true } },
      } }), db.projectCommentReport.findMany({ where: { reporterId: user.id }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, bodySnapshot: true, category: true, statement: true, status: true, retractedAt: true, decision: true,
        decisionReason: true, createdAt: true, comment: { select: { project: { select: { title: true } }, status: true,
          appeal: { select: { decision: true } } } },
      } })])
  return <><GlobalHeader /><main className="moderation-shell shell-with-header">
    <h1>我的内容举报</h1><p>每份举报有自己的处理记录。举报人信息不会公开给项目发起人。</p>
    {reports.length === 0 && projects.length === 0 && comments.length === 0 && <p className="empty-state compact-empty">暂时没有提交过内容举报。</p>}
    {projects.length > 0 && <section><h2>项目举报</h2><div className="moderation-list">{projects.map(report => <article className="panel governance-panel" key={report.id}>
      <strong>{report.titleSnapshot}</strong><p>提交于 {report.createdAt.toLocaleString('zh-CN')} · {report.status === 'PENDING' ? '待核查' : report.decision === 'UNLISTED' ? report.project.status === 'HIDDEN' ? '项目目前已下架' : '原下架已被纠正，项目目前公开' : '核查完毕，未下架'}</p>
      {report.decisionReason && <p>原处理依据：{report.decisionReason}</p>}
    </article>)}</div></section>}
    {reports.length > 0 && <h2>动态举报</h2>}
    <div className="moderation-list">{reports.map(report => <section className="panel governance-panel" key={report.id}>
      <strong>{report.titleSnapshot}</strong><p>提交于 {report.createdAt.toLocaleString('zh-CN')} · {report.status === 'PENDING' ? '等待网站核查' : report.decision === 'CONTENT_REMOVED' ? report.update.status === 'HIDDEN' ? '内容现已暂时下架' : '原下架结果后来发生变化，请以动态当前状态为准' : '核查完毕，未下架'}</p>
      {report.decisionReason && <p>处理依据：{report.decisionReason}</p>}
    </section>)}</div>
    {comments.length > 0 && <section><h2>评论与回复举报</h2><div className="moderation-list">{comments.map(item =>
      <article className="panel governance-panel" key={item.id}>
        <strong>项目「{item.comment.project.title}」 · {COMMENT_REPORT_CATEGORIES[item.category as keyof typeof COMMENT_REPORT_CATEGORIES] ?? '其他问题'}</strong>
        <p>举报时原文：{item.bodySnapshot}</p><p>您的说明：{item.statement}</p>
        <p>提交于 {item.createdAt.toLocaleString('zh-CN')} · {item.status === 'WITHDRAWN' ? '已撤回' :
          item.status === 'PENDING' ? '等待独立审核' : item.decision === 'AUTHOR_REMOVED' ? '作者主动删除，网站尚未认定违规' : item.decision === 'HIDDEN' ?
            item.comment.status === 'HIDDEN' ? '相关评论已下架' : '原下架决定已纠正，评论目前公开' : '核查后维持公开'}</p>
        {item.retractedAt && <p>您于 {item.retractedAt.toLocaleString('zh-CN')} 撤回原举报；已作出的独立裁决不会自动失效。</p>}
        {item.decisionReason && <p>原处理依据：{item.decisionReason}</p>}
        {item.comment.appeal?.decision === 'REOPENED' && <p>后经独立申诉恢复公开，原结论继续留档。</p>}
        {item.status !== 'WITHDRAWN' && !item.retractedAt && <WithdrawCommentReportForm reportId={item.id} />}
      </article>)}</div></section>}
  </main></>
}
