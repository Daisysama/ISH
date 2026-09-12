import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentAdmin, hasSitePermission } from '@/backend/auth/admin'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { UpdateReportDecisionForm } from '@/frontend/components/governance/UpdateReportDecisionForm'
import { DecideHiddenUpdateAppealForm } from '@/frontend/components/governance/HiddenUpdateAppealForms'
import { DecideProjectReportForm, DecideProjectReportAppealForm, OwnerRestoreProjectForm } from '@/frontend/components/governance/ProjectReportForms'
import { isSiteOwner } from '@/backend/auth/admin'
import { formatProjectTags, PROJECT_REPORT_CATEGORIES, UPDATE_REPORT_CATEGORIES } from '@/shared/governance-labels'

export const metadata = { title: '公开动态举报审查 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ReportReviewPage() {
  const admin = await getCurrentAdmin('REPORT_REVIEW')
  if (!admin) notFound()
  const canViewUpdateAudit = await hasSitePermission(admin.id, 'PROJECT_REVIEW')
  const [projectReports, projectAppeals, unlistedProjects] = await Promise.all([
    db.projectReport.findMany({ where: { status: 'PENDING', reporterId: { not: admin.id }, project: { creatorId: { not: admin.id } } },
      orderBy: { createdAt: 'asc' }, take: 100, include: { project: { select: { title: true, summary: true, version: true, typeTags: true, creator: { select: { displayName: true } } } },
        reporter: { select: { displayName: true } } },
    }),
    db.projectReportAppeal.findMany({ where: { status: 'PENDING', appellantId: { not: admin.id },
      originalReviewerId: { not: admin.id }, reporterIdSnapshot: { not: admin.id },
      report: { project: { creatorId: { not: admin.id } } } }, orderBy: { createdAt: 'asc' }, take: 100,
      include: { report: { include: { project: { select: { title: true, creator: { select: { displayName: true } } } },
        reviewedBy: { select: { displayName: true } } } } },
    }),
    isSiteOwner(admin.id) ? db.projectReport.findMany({ where: { decision: 'UNLISTED', mergedIntoId: null,
      project: { status: 'HIDDEN' }, reviewedById: { not: admin.id }, reporterId: { not: admin.id },
    }, orderBy: { reviewedAt: 'desc' }, take: 30, include: { project: { select: { creatorId: true, title: true } } } }) : Promise.resolve([]),
  ])
  const [reports, appeals, completed] = await Promise.all([db.projectUpdateReport.findMany({
    where: { status: 'PENDING', reporterId: { not: admin.id }, update: {
      authorId: { not: admin.id }, project: { creatorId: { not: admin.id } },
    } },
    orderBy: { createdAt: 'asc' }, take: 100,
    include: { update: { select: { authorNameSnapshot: true, project: { select: { title: true } } } },
      reporter: { select: { displayName: true } } },
  }), db.projectUpdateRemovalAppeal.findMany({ where: { status: 'PENDING', appellantId: { not: admin.id },
    originalReviewerId: { not: admin.id }, reporterIdSnapshot: { not: admin.id },
    update: { project: { creatorId: { not: admin.id } } } },
    orderBy: { createdAt: 'asc' }, take: 100,
    include: { update: { select: { title: true, authorNameSnapshot: true,
      project: { select: { title: true } } } } },
  }), db.projectUpdateReport.findMany({ where: { status: 'RESOLVED', reporterId: { not: admin.id },
    update: { project: { creatorId: { not: admin.id } }, authorId: { not: admin.id } } },
    orderBy: { reviewedAt: 'desc' }, take: 30,
    select: { id: true, updateId: true, titleSnapshot: true, decision: true, decisionReason: true, reviewedAt: true },
  })])
  return <>
    <GlobalHeader active="governance" />
    <main className="moderation-shell shell-with-header"><Link className="page-breadcrumb" href="/admin/governance">← 网站治理</Link><span className="eyebrow">INDEPENDENT REVIEW</span>
      <h1>内容举报</h1><p>按等待最久优先。举报人陈述只供独立网站审查员核查，不向项目发起人披露。</p>
      {projectAppeals.length > 0 && <section><h2>项目下架申诉 · {projectAppeals.length}</h2><div className="moderation-list">{projectAppeals.map(appeal => <article className="moderation-card" key={appeal.id}>
        <h3>{appeal.report.titleSnapshot} · 发起人：{appeal.report.project.creator.displayName}</h3>
        <p>原审查员：{appeal.report.reviewedBy?.displayName ?? '记录已归档'} · 原下架依据：{appeal.reasonSnapshot}</p>
        <p>申诉说明：{appeal.statement}</p><DecideProjectReportAppealForm appealId={appeal.id} />
      </article>)}</div></section>}
      {projectReports.length > 0 && <section><h2>公开项目举报 · {projectReports.length}</h2><div className="moderation-list">{projectReports.map(report => <article className="moderation-card" key={report.id}>
        <p>待审 · {report.createdAt.toLocaleString('zh-CN')} · 被举报版本 V{report.versionSnapshot}</p>
        <h3>{report.titleSnapshot}</h3><p>项目发起人：{report.project.creator.displayName} · 举报人：{report.reporter.displayName}</p>
        {report.project.version !== report.versionSnapshot && <p className="notice notice-private">举报提交后项目已更新为 V{report.project.version}。目前标题：{report.project.title}；简介：{report.project.summary}；项目类型：{report.project.typeTags.join('、')}。核对现在的项目，再决定是否下架。</p>}
        <p>项目简介：{report.summarySnapshot}</p>{report.descriptionSnapshot && <p className="update-body">项目内容：{report.descriptionSnapshot}</p>}
        <p>原标签快照：{formatProjectTags(report.tagsSnapshot)}</p>
        <p>举报类别：{PROJECT_REPORT_CATEGORIES[report.category as keyof typeof PROJECT_REPORT_CATEGORIES] ?? '其他问题'}</p>
        <p className="update-body">举报说明：{report.statement}</p><DecideProjectReportForm reportId={report.id} versionChanged={report.project.version !== report.versionSnapshot} />
      </article>)}</div></section>}
      {reports.length === 0 && appeals.length === 0 && projectReports.length === 0 && projectAppeals.length === 0 && <section className="empty-state compact-empty"><h2>目前没有您可以独立处理的举报或下架申诉。</h2></section>}
      {appeals.length > 0 && <section><h2>下架申诉 · {appeals.length}</h2><div className="moderation-list">{appeals.map(appeal => <article key={appeal.id} className="moderation-card">
        <h3>{appeal.update.project.title} · {appeal.update.title}</h3><p>作者：{appeal.update.authorNameSnapshot}</p>
        <p>原下架依据：{appeal.reasonSnapshot}</p><p className="update-body">作者申诉：{appeal.statement}</p>
        <DecideHiddenUpdateAppealForm appealId={appeal.id} />
      </article>)}</div></section>}
      <div className="moderation-list">{reports.map(report => <article key={report.id} className="moderation-card">
        <div className="project-card-meta"><span>待处理</span><time dateTime={report.createdAt.toISOString()}>{report.createdAt.toLocaleString('zh-CN')}</time></div>
        <h2>{report.titleSnapshot}</h2>
        <p>项目：{report.update.project.title} · 作者：{report.update.authorNameSnapshot} · 举报人：{report.reporter.displayName}</p>
        <p className="update-body">原内容：{report.bodySnapshot}</p><p>问题类型：{UPDATE_REPORT_CATEGORIES[report.reason as keyof typeof UPDATE_REPORT_CATEGORIES] ?? '其他问题'}</p>
        <p className="update-body">举报说明：{report.statement}</p><UpdateReportDecisionForm reportId={report.id} />
      </article>)}</div>
      {unlistedProjects.length > 0 && <section className="panel governance-panel"><h2>站主可纠正的项目下架</h2>{unlistedProjects.filter(report => report.project.creatorId !== admin.id).map(report => <article className="governance-rule-item" key={report.id}>
        <strong>{report.project.title}</strong><p>原下架依据：{report.decisionReason}</p><OwnerRestoreProjectForm reportId={report.id} />
      </article>)}</section>}
      {completed.length > 0 && <section className="panel governance-panel"><h2>近期处理记录</h2>{completed.map(item => <p key={item.id}>
        {item.reviewedAt?.toLocaleString('zh-CN')} · {item.titleSnapshot} · {item.decision === 'CONTENT_REMOVED' ? '内容已下架' : '未下架'} · {item.decisionReason}
        {canViewUpdateAudit && <> <Link className="story-link" href={`/admin/updates/${item.updateId}?from=reports`}>查看动态审核历史 →</Link></>}
      </p>)}</section>}
    </main>
  </>
}
