import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getCurrentAdmin, isSiteOwner } from '@/backend/auth/admin'
import { getUpdateModerationRecord } from '@/backend/updates/queries'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { ProjectUpdateReviewForm } from '@/frontend/components/updates/ProjectUpdateReviewForm'
import { ProjectUpdateCorrectionForm } from '@/frontend/components/updates/ProjectUpdateCorrectionForm'
import { formatMatchedRules } from '@/shared/governance-labels'

export const metadata = { title: '项目动态审核记录 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function UpdateModerationDetail({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string | string[] }>
}) {
  const admin = await getCurrentAdmin('PROJECT_REVIEW')
  if (!admin) notFound()
  const { id } = await params
  const from = (await searchParams).from
  const fromReports = (Array.isArray(from) ? from[0] : from) === 'reports'
  const record = await getUpdateModerationRecord(id)
  if (!record) notFound()
  const conflict = admin.id === record.project.creatorId || admin.id === record.authorId ||
    record.events.some(event => event.type === 'REOPENED' &&
      (event.actorUserId === admin.id || event.previousReviewerIdSnapshot === admin.id))
  return (
    <>
      <GlobalHeader active="moderation" />
      <main className="moderation-shell shell-with-header update-moderation-detail">
        <Link className="page-breadcrumb" href={fromReports ? '/admin/reports' : '/admin/moderation'}>← {fromReports ? '内容举报' : '项目审核'}</Link>
        <span className="eyebrow">PROJECT UPDATE REVIEW</span>
        <h1>「{record.project.title}」的动态</h1>
        <p>状态：{record.status === 'PENDING' ? '等待审核' : record.status === 'PUBLISHED' ? '已公开' : record.status === 'HIDDEN' ? '已下架' : '已退回'} · 投稿人：{record.authorNameSnapshot} · 提交于 {record.submittedAt.toLocaleString('zh-CN')}</p>
        {record.scan && <p>自动筛查：{record.scan.result === 'CLEAR' ? '未命中规则' : record.scan.result === 'BLOCK' ? '曾暂缓发布' : '曾提示人工核查'}；规则快照：{formatMatchedRules(record.scan.matchedRules)}</p>}
        <article className="panel update-review-record"><h2>{record.title}</h2><p className="update-body">{record.body}</p></article>
        {record.status === 'PENDING' && (conflict
          ? <p className="notice notice-danger">您是该项目发起人或动态作者，请交由另一位网站管理员审核。</p>
          : <section className="panel update-review-record"><h2>审核这条动态</h2><ProjectUpdateReviewForm updateId={record.id} /></section>)}
        {record.rejectionReason && <p className="notice notice-danger">退回原因：{record.rejectionReason}</p>}
        {isSiteOwner(admin.id) && record.status !== 'PENDING' && record.reviewedById !== admin.id &&
          <ProjectUpdateCorrectionForm updateId={record.id} />}
        <section className="panel update-review-record"><h2>审核记录</h2>
          <div className="review-audit-events">
            {record.events.map(event => <p key={event.id}>
              {event.type === 'SUBMITTED' ? '提交' : event.type === 'APPROVED' ? '审核通过' : event.type === 'AUTO_APPROVED' ? '按站主设置自动公开' : event.type === 'REJECTED' ? '退回' : event.type === 'REVIEW_REQUESTED' ? '作者申请人工复核' : event.type === 'HIDDEN' ? '举报核查后下架' : '站主撤销裁决并重开'}
              {' · '}{event.actor?.displayName ?? '已注销账号'} · {event.createdAt.toLocaleString('zh-CN')}
              {event.type === 'REOPENED' && <span> · 原结论：{event.previousStatus === 'PUBLISHED' ? '已公开' : event.previousStatus === 'HIDDEN' ? '已下架' : '已退回'}
                {event.previousReviewedAtSnapshot && ` · 原审核于 ${event.previousReviewedAtSnapshot.toLocaleString('zh-CN')}`}
                {event.previousReasonSnapshot && ` · 原退回原因：${event.previousReasonSnapshot}`}</span>}
              {event.note && ` · ${event.note}`}
            </p>)}
          </div>
        </section>
      </main>
    </>
  )
}
