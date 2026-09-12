'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getCurrentUser } from '@/backend/auth/current-user'
import { isSiteOwner } from '@/backend/auth/admin'
import { normalizeEmail } from '@/backend/auth/password'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'
import { SITE_PERMISSIONS } from '@/core/governance/permissions'

export type StaffActionState = { error?: string; success?: string }

export async function setSiteAdminAction(_previous: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const owner = await getCurrentUser()
  if (!owner) redirect('/login')
  if (!isSiteOwner(owner.id)) return { error: '只有网站站主可以授权网站管理员。' }

  const email = z.string().email().safeParse(normalizeEmail(String(formData.get('email') ?? '')))
  const reason = z.string().trim().min(10).max(500).safeParse(formData.get('reason'))
  const operation = z.enum(['GRANT', 'REVOKE']).safeParse(formData.get('operation'))
  const requested = formData.getAll('permissions')
  if (!email.success) return { error: '请输入已注册用户的有效邮箱。' }
  if (!reason.success) return { error: '请写 10～500 字说明授权或撤销原因。' }
  if (!operation.success) return { error: '操作类型无效。' }
  if (requested.some(value => typeof value !== 'string' || !SITE_PERMISSIONS.includes(value as typeof SITE_PERMISSIONS[number]))) {
    return { error: '包含未知的权限选项。' }
  }
  const permissions = [...new Set(requested as string[])]
  if (operation.data === 'GRANT' && permissions.length === 0) return { error: '请至少选一项权限。' }
  if (operation.data === 'GRANT' && permissions.includes('APPEAL_CORRECTION') && !permissions.includes('APPEAL_REVIEW')) {
    return { error: '申诉裁决纠错需同时授予“独立申诉审查”。' }
  }

  const target = await db.user.findUnique({ where: { email: email.data }, select: { id: true, displayName: true } })
  if (!target) return { error: '此邮箱尚未注册，请先让对方创建账号。' }
  if (target.id === owner.id) return { error: '站主已有最高权限，无需给自己设置管理员角色。' }

  let result: StaffActionState = { success: '' }
  await db.$transaction(async tx => {
    const previous = await tx.siteAdmin.findUnique({ where: { userId: target.id } })
    if (operation.data === 'REVOKE' && !previous?.active) {
      result = { error: '该账号当前不是管理员。' }
      return
    }
    if (operation.data === 'GRANT' && previous?.active &&
      previous.permissions.length === permissions.length && previous.permissions.every(value => permissions.includes(value))) {
      result = { error: '所选权限没有变化。' }
      return
    }
    const after = operation.data === 'GRANT' ? permissions : []
    await tx.siteAdmin.upsert({
      where: { userId: target.id },
      create: { userId: target.id, permissions: after, active: operation.data === 'GRANT', assignedById: owner.id },
      update: { permissions: after, active: operation.data === 'GRANT', assignedById: owner.id, assignedAt: new Date() },
    })
    await tx.siteGovernanceEvent.create({
      data: {
        actorUserId: owner.id, targetUserId: target.id,
        action: operation.data === 'REVOKE' ? 'ADMIN_REVOKED' : previous?.active ? 'PERMISSIONS_CHANGED' : 'ADMIN_GRANTED',
        beforePermissions: previous?.active ? previous.permissions : [], afterPermissions: after, reason: reason.data,
      },
    })
    await createNotifications(tx, [{
      recipientUserId: target.id, sourceKey: `staff:${randomUUID()}`,
      type: 'STAFF_ACCESS_CHANGED', title: operation.data === 'REVOKE' ? '网站管理员权限已撤销' : '网站管理员权限已更新',
      summary: `站主已${operation.data === 'REVOKE' ? '撤销' : '调整'}您的网站管理权限；请在账号中查看。`, href: '/notifications',
    }])
    if (after.includes('APPEAL_REVIEW')) {
      const pending = await tx.projectRemovalReview.findMany({
        where: {
          recipient: 'PLATFORM', status: 'PENDING', appellantUserId: { not: target.id },
          project: { creatorId: { not: target.id } },
          events: { none: { type: 'REOPENED', OR: [{ actorUserId: target.id }, { deciderUserIdSnapshot: target.id }] } },
        },
        select: { id: true },
      })
      await createNotifications(tx, pending.map(review => ({
        recipientUserId: target.id, sourceKey: `appeal:${review.id}`, type: 'PLATFORM_APPEAL_SUBMITTED',
        title: '有同行移出申诉待独立审查', summary: '您已获申诉审查权限，可查看原始记录及当事人说明。',
        href: '/admin/removal-appeals',
      })))
    } else if (previous?.permissions.includes('APPEAL_REVIEW')) {
      await tx.userNotification.updateMany({
        where: { recipientUserId: target.id, type: 'PLATFORM_APPEAL_SUBMITTED', readAt: null },
        data: { readAt: new Date() },
      })
    }
    if (after.includes('PROJECT_REVIEW')) {
      const updates = await tx.projectUpdate.findMany({
        where: { status: 'PENDING', authorId: { not: target.id }, project: { creatorId: { not: target.id } } },
        select: {
          id: true, project: { select: { title: true } },
          events: { where: { type: 'REOPENED' }, select: { actorUserId: true, previousReviewerIdSnapshot: true } },
        },
      })
      await createNotifications(tx, updates.filter(update => !update.events.some(event =>
        event.actorUserId === target.id || event.previousReviewerIdSnapshot === target.id,
      )).map(update => ({
        recipientUserId: target.id, sourceKey: `update-review:${update.id}`,
        type: 'PROJECT_UPDATE_SUBMITTED', title: '有项目动态等待网站审核',
        summary: `项目「${update.project.title}」有动态待审。`, href: `/admin/updates/${update.id}`,
      })))
    } else if (previous?.permissions.includes('PROJECT_REVIEW')) {
      await tx.userNotification.updateMany({
        where: { recipientUserId: target.id, type: 'PROJECT_UPDATE_SUBMITTED', readAt: null },
        data: { readAt: new Date() },
      })
    }
    if (after.includes('REPORT_REVIEW')) {
      const projectReports = await tx.projectReport.findMany({ where: {
        status: 'PENDING', reporterId: { not: target.id }, project: { creatorId: { not: target.id } },
      }, select: { id: true } })
      await createNotifications(tx, projectReports.map(item => ({ recipientUserId: target.id,
        sourceKey: `project-report:${item.id}`, type: 'PROJECT_REPORT_SUBMITTED',
        title: '有项目举报待独立核查', summary: '您已获举报审查权限，可核对当前项目版本与举报人说明。', href: '/admin/reports',
      })))
      const projectAppeals = await tx.projectReportAppeal.findMany({ where: {
        status: 'PENDING', appellantId: { not: target.id }, originalReviewerId: { not: target.id },
        reporterIdSnapshot: { not: target.id }, report: { project: { creatorId: { not: target.id } } },
      }, select: { id: true } })
      await createNotifications(tx, projectAppeals.map(item => ({ recipientUserId: target.id,
        sourceKey: `project-report-appeal:${item.id}`, type: 'PROJECT_REPORT_APPEAL',
        title: '有项目下架申诉待独立核查', summary: '须回避原审查人、发起人和举报人。', href: '/admin/reports',
      })))
      const reports = await tx.projectUpdateReport.findMany({ where: {
        status: 'PENDING', reporterId: { not: target.id },
        update: { authorId: { not: target.id }, project: { creatorId: { not: target.id } } },
      }, select: { id: true } })
      await createNotifications(tx, reports.map(report => ({
        recipientUserId: target.id, sourceKey: `report:${report.id}`, type: 'UPDATE_REPORT_SUBMITTED',
        title: '有公开动态举报待独立审查', summary: '您已获得举报审查权限，请查看原内容与举报说明。', href: '/admin/reports',
      })))
      const hiddenAppeals = await tx.projectUpdateRemovalAppeal.findMany({ where: {
        status: 'PENDING', appellantId: { not: target.id }, originalReviewerId: { not: target.id },
        reporterIdSnapshot: { not: target.id }, update: { project: { creatorId: { not: target.id } } },
      }, select: { id: true } })
      await createNotifications(tx, hiddenAppeals.map(appeal => ({
        recipientUserId: target.id, sourceKey: `hidden-update-appeal:${appeal.id}`,
        type: 'HIDDEN_UPDATE_APPEAL', title: '有下架动态申诉需独立核查',
        summary: '已获得举报审查权限，可查看原处理依据与作者申诉。', href: '/admin/reports',
      })))
    } else if (previous?.permissions.includes('REPORT_REVIEW')) {
      await tx.userNotification.updateMany({ where: { recipientUserId: target.id, type: 'PROJECT_REPORT_SUBMITTED', readAt: null }, data: { readAt: new Date() } })
      await tx.userNotification.updateMany({ where: { recipientUserId: target.id, type: 'PROJECT_REPORT_APPEAL', readAt: null }, data: { readAt: new Date() } })
      await tx.userNotification.updateMany({ where: { recipientUserId: target.id, type: 'UPDATE_REPORT_SUBMITTED', readAt: null }, data: { readAt: new Date() } })
      await tx.userNotification.updateMany({ where: { recipientUserId: target.id, type: 'HIDDEN_UPDATE_APPEAL', readAt: null }, data: { readAt: new Date() } })
    }
    if (after.includes('SANCTION_APPEAL_REVIEW')) {
      const appeals = await tx.userSanctionAppeal.findMany({ where: { status: 'PENDING', appellantId: { not: target.id },
        sanction: { issuedById: { not: target.id } } }, select: { id: true } })
      await createNotifications(tx, appeals.map(appeal => ({
        recipientUserId: target.id, sourceKey: `sanction-appeal:${appeal.id}`,
        type: 'SANCTION_APPEAL_SUBMITTED', title: '有账号处分申诉需独立审查',
        summary: '您已获得账号处分申诉审查权限；原处分人不能审理自己的案件。', href: '/admin/sanction-appeals',
      })))
    } else if (previous?.permissions.includes('SANCTION_APPEAL_REVIEW')) {
      await tx.userNotification.updateMany({ where: { recipientUserId: target.id, type: 'SANCTION_APPEAL_SUBMITTED', readAt: null }, data: { readAt: new Date() } })
    }
    result = { success: `${target.displayName} 的网站管理员权限已${operation.data === 'REVOKE' ? '撤销' : '保存'}；操作已留痕。` }
  })
  revalidatePath('/admin/staff')
  revalidatePath('/admin/removal-appeals')
  revalidatePath('/admin/reports')
  revalidatePath('/admin/sanction-appeals')
  revalidatePath('/notifications')
  return result
}
