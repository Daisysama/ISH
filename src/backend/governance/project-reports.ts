'use server'

import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { getCurrentAdmin, getSiteOwnerUserId } from '@/backend/auth/admin'
import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'
import { refreshProjectReports } from '@/backend/governance/project-report-refresh'

export type ProjectReportState = { error?: string; success?: string }
const uuid = z.string().uuid()
const description = z.string().trim().min(10, '请至少写 10 个字说明事实。').max(2000)

export async function submitProjectReportAction(_previous: ProjectReportState, form: FormData): Promise<ProjectReportState> {
  const reporter = await getCurrentUser()
  if (!reporter) return { error: '请先登录再举报项目。' }
  const id = uuid.safeParse(form.get('projectId'))
  const input = z.object({ category: z.enum(['STOLEN_WORK', 'UNLICENSED_ASSETS', 'FAKE_PROJECT', 'MISLEADING_TAGS', 'CONTENT_VIOLATION', 'OTHER']),
    statement: description }).safeParse({ category: form.get('category'), statement: form.get('statement') })
  if (!id.success || !input.success) return { error: input.success ? '项目编号无效。' : input.error.issues[0].message }
  try {
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${id.data} FOR UPDATE`
      const project = await tx.project.findUnique({ where: { id: id.data }, select: {
        id: true, title: true, summary: true, description: true, typeTags: true, seekingTags: true, creatorId: true, version: true, status: true,
      } })
      if (!project || project.status !== 'PUBLISHED') throw new Error('NOT_PUBLIC')
      if (project.creatorId === reporter.id) throw new Error('OWN_PROJECT')
      const today = new Date(); today.setUTCHours(0, 0, 0, 0)
      if (await tx.projectReport.count({ where: { reporterId: reporter.id, createdAt: { gte: today } } }) >= 10) throw new Error('LIMIT')
      const report = await tx.projectReport.create({ data: {
        projectId: project.id, reporterId: reporter.id, category: input.data.category, statement: input.data.statement,
        titleSnapshot: project.title, summarySnapshot: project.summary, descriptionSnapshot: project.description,
        tagsSnapshot: { typeTags: project.typeTags, seekingTags: project.seekingTags }, versionSnapshot: project.version,
      } })
      await tx.projectReportEvent.create({ data: { reportId: report.id, actorUserId: reporter.id, action: 'SUBMITTED' } })
      const staff = await tx.siteAdmin.findMany({ where: { active: true, permissions: { has: 'REPORT_REVIEW' } }, select: { userId: true } })
      const eligible = new Set(staff.map(person => person.userId))
      const ownerId = getSiteOwnerUserId()
      if (ownerId) eligible.add(ownerId)
      eligible.delete(reporter.id); eligible.delete(project.creatorId)
      await createNotifications(tx, [...eligible].map(recipientUserId => ({ recipientUserId,
        sourceKey: `project-report:${report.id}`, type: 'PROJECT_REPORT_SUBMITTED',
        title: '有项目举报待独立核查', summary: `项目「${project.title}」的公开版收到举报。`, href: '/admin/reports',
      })))
      if (!eligible.size && ownerId) await createNotifications(tx, [{ recipientUserId: ownerId,
        sourceKey: `project-report-assignment:${report.id}`, type: 'REPORT_ASSIGNMENT_NEEDED',
        title: '项目举报缺少独立审查员', summary: '请授权与本项目和举报人无利益冲突的网站管理员。', href: '/admin/staff',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_PUBLIC') return { error: '只有仍公开的项目可从这里举报，请刷新核对。' }
    if (error instanceof Error && error.message === 'OWN_PROJECT') return { error: '项目发起人不能举报自己发起的项目。' }
    if (error instanceof Error && error.message === 'LIMIT') return { error: '今天的举报已达上限，请明天再试。' }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { error: '您已经举报过本项目的当前版本，可到「我的举报」查看进度。' }
    throw error
  }
  refreshProjectReports(id.data)
  return { success: '举报已交独立网站管理员；发起人不能读取您的举报说明或审理自己的案件。' }
}

export async function decideProjectReportAction(_previous: ProjectReportState, form: FormData): Promise<ProjectReportState> {
  const admin = await getCurrentAdmin('REPORT_REVIEW')
  if (!admin) return { error: '您没有网站举报审查权限。' }
  const id = uuid.safeParse(form.get('reportId'))
  const decision = z.enum(['NO_VIOLATION', 'UNLISTED']).safeParse(form.get('decision'))
  const reason = description.safeParse(form.get('reason'))
  if (!id.success || !decision.success || !reason.success) return { error: '请核对举报、结论及至少 10 字依据。' }
  let projectId = ''
  try {
    await db.$transaction(async tx => {
      const source = await tx.projectReport.findUnique({ where: { id: id.data }, select: { projectId: true } })
      if (!source) throw new Error('STALE')
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${source.projectId} FOR UPDATE`
      const report = await tx.projectReport.findUnique({ where: { id: id.data }, include: {
        project: { select: { id: true, title: true, creatorId: true, status: true, version: true } },
      } })
      if (!report || report.status !== 'PENDING' || report.project.status !== 'PUBLISHED') throw new Error('STALE')
      if ([report.reporterId, report.project.creatorId].includes(admin.id)) throw new Error('CONFLICT')
      if (report.project.version !== report.versionSnapshot && decision.data === 'UNLISTED' && form.get('acknowledgeVersionChange') !== 'on') {
        throw new Error('VERSION_CHANGED')
      }
      projectId = report.projectId
      const now = new Date()
      const changed = await tx.projectReport.updateMany({ where: { id: report.id, status: 'PENDING' }, data: {
        status: 'RESOLVED', decision: decision.data, decisionReason: reason.data, reviewedById: admin.id, reviewedAt: now,
      } })
      if (changed.count !== 1) throw new Error('STALE')
      await tx.projectReportEvent.create({ data: { reportId: report.id, actorUserId: admin.id, action: decision.data, note: reason.data } })
      if (decision.data === 'UNLISTED') {
        const updated = await tx.project.updateMany({ where: { id: projectId, status: 'PUBLISHED' },
          data: { status: 'HIDDEN', rejectionReason: `网站经举报核查暂时下架：${reason.data}` } })
        if (updated.count !== 1) throw new Error('STALE')
        const duplicates = await tx.projectReport.findMany({ where: { projectId, status: 'PENDING' }, select: { id: true, reporterId: true } })
        if (duplicates.length) {
          await tx.projectReport.updateMany({ where: { id: { in: duplicates.map(item => item.id) }, status: 'PENDING' }, data: {
            status: 'RESOLVED', decision: 'UNLISTED', mergedIntoId: report.id,
            decisionReason: `并入本项目另一举报：${reason.data}`, reviewedById: admin.id, reviewedAt: now,
          } })
          await tx.projectReportEvent.createMany({ data: duplicates.map(item => ({
            reportId: item.id, actorUserId: admin.id, action: 'MERGED', note: `并入 ${report.id}：${reason.data}`,
          })) })
          await createNotifications(tx, duplicates.map(item => ({ recipientUserId: item.reporterId,
            sourceKey: `project-report-result:${item.id}`, type: 'PROJECT_REPORT_RESULT',
            title: '您的项目举报已有结果', summary: `项目「${report.project.title}」已暂时下架。`, href: '/reports',
          })))
          await tx.userNotification.updateMany({ where: { sourceKey: { in: duplicates.map(item => `project-report:${item.id}`) }, readAt: null }, data: { readAt: now } })
        }
        await createNotifications(tx, [{ recipientUserId: report.project.creatorId,
          sourceKey: `project-hidden:${report.id}`, type: 'PROJECT_UNLISTED', title: '您的项目已暂时下架',
          summary: `项目「${report.project.title}」的原处理依据与独立申诉入口在项目详情中。`, href: `/projects/${projectId}?from=notifications`,
        }])
      }
      await tx.userNotification.updateMany({ where: { sourceKey: `project-report:${report.id}`, readAt: null }, data: { readAt: now } })
      await createNotifications(tx, [{ recipientUserId: report.reporterId,
        sourceKey: `project-report-result:${report.id}`, type: 'PROJECT_REPORT_RESULT',
        title: '您的项目举报已有结果', summary: `项目「${report.project.title}」${decision.data === 'UNLISTED' ? '暂时下架' : '经核查维持公开'}。`, href: '/reports',
      }])
      const ownerId = getSiteOwnerUserId()
      if (ownerId && ownerId !== admin.id) await createNotifications(tx, [{ recipientUserId: ownerId,
        sourceKey: `owner-project-report:${report.id}`, type: 'OWNER_PROJECT_REPORT_RESULT',
        title: '管理员处理了项目举报', summary: `${admin.displayName} 已处理项目「${report.project.title}」的举报，原结论与依据已留档。`, href: '/admin/reports',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE') return { error: '举报或项目状态已变化，请刷新页面。' }
    if (error instanceof Error && error.message === 'CONFLICT') return { error: '发起人或举报人不能审核本案。' }
    if (error instanceof Error && error.message === 'VERSION_CHANGED') return { error: '举报提交后项目已修改；请重新核对当前版本，再确认下架。' }
    throw error
  }
  refreshProjectReports(projectId)
  return { success: decision.data === 'UNLISTED' ? '项目已暂时下架，原举报快照和处理依据保留。' : '维持项目公开，并通知举报人。' }
}
