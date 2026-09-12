import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { getSiteAccess, isSiteOwner } from '@/backend/auth/admin'
import { normalizeEmail } from '@/backend/auth/password'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { AdminPermissionForm } from '@/frontend/components/staff/AdminPermissionForm'
import { AuthorizationLog } from '@/frontend/components/staff/AuthorizationLog'

export const metadata = { title: '网站管理员 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const owner = await getCurrentUser()
  if (!owner) notFound()
  const access = await getSiteAccess(owner.id)
  if (!isSiteOwner(owner.id) && !access.permissions.includes('GOVERNANCE_LOG_VIEW')) notFound()
  if (!isSiteOwner(owner.id)) return <><GlobalHeader active="governance" /><main className="moderation-shell shell-with-header staff-page">
    <Link className="page-breadcrumb" href="/admin/governance">← 网站治理</Link>
    <h1>网站管理员与授权记录</h1><p>您可以只读查看授权历史；只有站主能授予或撤销权限。</p>
    <AuthorizationLog />
  </main></>
  const { email = '' } = await searchParams
  const exactEmail = normalizeEmail(email).slice(0, 254)
  const [admins, selected, pendingAppeals, pendingUpdates, pendingReports, pendingSanctionAppeals, pendingHiddenAppeals, pendingProjectReports, pendingProjectReportAppeals] = await Promise.all([
    db.siteAdmin.findMany({
      where: { active: true }, orderBy: { assignedAt: 'desc' },
      select: { userId: true, permissions: true, user: { select: { email: true, displayName: true } } },
    }),
    exactEmail ? db.user.findUnique({
      where: { email: exactEmail }, select: { id: true, email: true, displayName: true, siteAdmin: { select: { active: true, permissions: true } } },
    }) : Promise.resolve(null),
    db.projectRemovalReview.findMany({
      where: { recipient: 'PLATFORM', status: 'PENDING' },
      select: {
        id: true, appellantUserId: true, project: { select: { creatorId: true } },
        events: { where: { type: 'REOPENED' }, select: { actorUserId: true, deciderUserIdSnapshot: true } },
      },
    }),
    db.projectUpdate.findMany({
      where: { status: 'PENDING' },
      select: {
        authorId: true, project: { select: { creatorId: true } },
        events: { where: { type: 'REOPENED' }, select: { actorUserId: true, previousReviewerIdSnapshot: true } },
      },
    }),
    db.projectUpdateReport.findMany({ where: { status: 'PENDING' }, select: {
      reporterId: true, update: { select: { authorId: true, project: { select: { creatorId: true } } } },
    } }),
    db.userSanctionAppeal.findMany({ where: { status: 'PENDING' }, select: { appellantId: true, sanction: { select: { issuedById: true } } } }),
    db.projectUpdateRemovalAppeal.findMany({ where: { status: 'PENDING' }, select: { appellantId: true, originalReviewerId: true,
      reporterIdSnapshot: true, update: { select: { project: { select: { creatorId: true } } } } } }),
    db.projectReport.findMany({ where: { status: 'PENDING' }, select: { reporterId: true, project: { select: { creatorId: true } } } }),
    db.projectReportAppeal.findMany({ where: { status: 'PENDING' }, select: { appellantId: true,
      reporterIdSnapshot: true, originalReviewerId: true, report: { select: { project: { select: { creatorId: true } } } } } }),
  ])
  const reviewers = admins.filter(admin => admin.permissions.includes('APPEAL_REVIEW')).map(admin => admin.userId)
  if (!reviewers.includes(owner.id)) reviewers.push(owner.id)
  const unassigned = pendingAppeals.filter(appeal => !reviewers.some(id =>
    id !== appeal.appellantUserId && id !== appeal.project.creatorId &&
    !appeal.events.some(event => id === event.actorUserId || id === event.deciderUserIdSnapshot),
  )).length
  const projectReviewers = admins.filter(admin => admin.permissions.includes('PROJECT_REVIEW')).map(admin => admin.userId)
  if (!projectReviewers.includes(owner.id)) projectReviewers.push(owner.id)
  const unassignedUpdates = pendingUpdates.filter(update =>
    !projectReviewers.some(id => id !== update.authorId && id !== update.project.creatorId &&
      !update.events.some(event => event.actorUserId === id || event.previousReviewerIdSnapshot === id)),
  ).length
  const reportReviewers = admins.filter(admin => admin.permissions.includes('REPORT_REVIEW')).map(admin => admin.userId)
  if (!reportReviewers.includes(owner.id)) reportReviewers.push(owner.id)
  const unassignedReports = pendingReports.filter(report => !reportReviewers.some(id =>
    id !== report.reporterId && id !== report.update.authorId && id !== report.update.project.creatorId,
  )).length
  const sanctionReviewers = admins.filter(admin => admin.permissions.includes('SANCTION_APPEAL_REVIEW')).map(admin => admin.userId)
  if (!sanctionReviewers.includes(owner.id)) sanctionReviewers.push(owner.id)
  const unassignedSanctionAppeals = pendingSanctionAppeals.filter(appeal =>
    !sanctionReviewers.some(id => id !== appeal.appellantId && id !== appeal.sanction.issuedById),
  ).length
  const unassignedHiddenAppeals = pendingHiddenAppeals.filter(appeal => !reportReviewers.some(id =>
    id !== appeal.appellantId && id !== appeal.originalReviewerId && id !== appeal.reporterIdSnapshot && id !== appeal.update.project.creatorId,
  )).length
  const unassignedProjectReports = pendingProjectReports.filter(report => !reportReviewers.some(id =>
    id !== report.reporterId && id !== report.project.creatorId,
  )).length
  const unassignedProjectAppeals = pendingProjectReportAppeals.filter(appeal => !reportReviewers.some(id =>
    id !== appeal.appellantId && id !== appeal.reporterIdSnapshot && id !== appeal.originalReviewerId && id !== appeal.report.project.creatorId,
  )).length

  return (
    <>
      <GlobalHeader active="governance" />
      <main className="moderation-shell shell-with-header staff-page">
        <Link className="page-breadcrumb" href="/admin/governance">← 网站治理</Link>
        <span className="eyebrow">SITE GOVERNANCE</span>
        <h1>网站管理员与授权记录</h1>
        <p>您以稳定账号 ID 作为站主。授权跟随账号，而不是随邮箱或显示名称变动；仅授予完成工作所需的权限。</p>
        {unassigned > 0 && <p className="notice notice-danger">有 {unassigned} 条申诉目前没有无利益冲突的审查员。请授权独立管理员；站主也不能审自己的案件。</p>}
        {unassignedUpdates > 0 && <p className="notice notice-danger">有 {unassignedUpdates} 条项目动态缺少无利益冲突的审核员。请授予另一位网站管理员“项目审核”权限。</p>}
        {unassignedReports > 0 && <p className="notice notice-danger">有 {unassignedReports} 条内容举报缺少独立审查员。请授权另一位网站管理员“举报审查”。</p>}
        {unassignedSanctionAppeals > 0 && <p className="notice notice-danger">有 {unassignedSanctionAppeals} 条账号处分申诉缺少独立审查员。请授权另一位网站管理员“封号申诉审查”。</p>}
        {unassignedHiddenAppeals > 0 && <p className="notice notice-danger">有 {unassignedHiddenAppeals} 条动态下架申诉缺少独立审查员。请授权另一位网站管理员“举报审查”。</p>}
        {unassignedProjectReports > 0 && <p className="notice notice-danger">有 {unassignedProjectReports} 条项目举报缺少独立审查员。</p>}
        {unassignedProjectAppeals > 0 && <p className="notice notice-danger">有 {unassignedProjectAppeals} 条项目下架申诉缺少独立审查员。</p>}
        <section className="panel staff-panel">
          <h2>查找已有账号</h2>
          <form method="get" className="staff-search">
            <label>对方注册时使用的邮箱<input type="email" name="email" defaultValue={exactEmail} required placeholder="someone@example.com" /></label>
            <button className="button button-quiet button-compact" type="submit">查找用户</button>
          </form>
          {exactEmail && !selected && <p>未找到该账号；请对方先注册。</p>}
          {selected?.id === owner.id && <p>这是站主自己的账号，已拥有全部管理权限。</p>}
          {selected && selected.id !== owner.id && <AdminPermissionForm key={selected.id} email={selected.email} displayName={selected.displayName} active={selected.siteAdmin?.active ?? false} currentPermissions={selected.siteAdmin?.permissions ?? []} />}
        </section>
        <section className="panel staff-panel">
          <h2>现任管理员 · {admins.length}</h2>
          {admins.length === 0 && <p>尚未授权任何管理员。站主有利益冲突的申诉需要另一位管理员处理。</p>}
          {admins.map(admin => (
            <AdminPermissionForm key={admin.userId} email={admin.user.email} displayName={admin.user.displayName} currentPermissions={admin.permissions} active />
          ))}
        </section>
        <AuthorizationLog />
      </main>
    </>
  )
}
