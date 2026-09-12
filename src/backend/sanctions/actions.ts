'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getCurrentAdmin, getSiteOwnerUserId, isSiteOwner } from '@/backend/auth/admin'
import { getCurrentUser } from '@/backend/auth/current-user'
import { normalizeEmail } from '@/backend/auth/password'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'

export type SanctionState = { error?: string; success?: string }
const uuid = z.string().uuid()

function refreshSanctions() {
  for (const path of ['/admin/sanctions', '/admin/sanction-appeals', '/account/limited', '/admin/staff', '/notifications']) revalidatePath(path)
}

export async function issueUserSanctionAction(_previous: SanctionState, data: FormData): Promise<SanctionState> {
  const admin = await getCurrentAdmin('USER_SANCTION')
  if (!admin) return { error: '您没有执行网站账号处分的权限。' }
  const parsed = z.object({ email: z.string().trim().email(), scope: z.enum(['COMMENTS', 'PROJECTS', 'RESPONSES', 'SITE']),
    durationDays: z.coerce.number().int().min(0).max(365),
    reason: z.string().trim().min(10, '请至少写 10 个字的处分依据。').max(2000),
  }).safeParse({ email: normalizeEmail(String(data.get('email') ?? '')), scope: data.get('scope'),
    durationDays: data.get('durationDays'), reason: data.get('reason') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (parsed.data.durationDays === 0 && !isSiteOwner(admin.id)) return { error: '永久处分只有站主可以执行。' }
  if (parsed.data.scope === 'SITE' && (!isSiteOwner(admin.id) || parsed.data.durationDays !== 0)) {
    return { error: '全站停用只有站主能执行，必须填写理由并保留可撤销的永久记录。' }
  }
  const target = await db.user.findUnique({ where: { email: parsed.data.email }, select: {
    id: true, displayName: true, siteAdmin: { select: { active: true, permissions: true } },
  } })
  if (!target) return { error: '没有找到该账号。' }
  if (target.id === admin.id || isSiteOwner(target.id)) return { error: '不能处分自己或站主账号。' }
  if (target.siteAdmin?.active && !isSiteOwner(admin.id)) return { error: '网站管理员账号的处分须由站主处理。' }
  try {
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${target.id}))`
      // 不同范围可以分别处分、分别申诉和撤销；同范围不可叠加，全站停用生效时不另发局部处分。
      const conflictingScopes = parsed.data.scope === 'SITE'
        ? ['SITE'] : [parsed.data.scope, 'SITE', 'ACCOUNT']
      const existing = await tx.userSanction.findFirst({ where: { targetId: target.id, status: 'ACTIVE',
        scope: { in: conflictingScopes as ('COMMENTS' | 'PROJECTS' | 'RESPONSES' | 'SITE' | 'ACCOUNT')[] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true } })
      if (existing) throw new Error('ALREADY_SANCTIONED')
      const expiresAt = parsed.data.durationDays ? new Date(Date.now() + parsed.data.durationDays * 86_400_000) : null
      const sanction = await tx.userSanction.create({ data: {
        targetId: target.id, issuedById: admin.id, scope: parsed.data.scope, reason: parsed.data.reason, expiresAt,
      } })
      await tx.userSanctionEvent.create({ data: { sanctionId: sanction.id, actorUserId: admin.id, action: 'ISSUED', reason: parsed.data.reason } })
      if (parsed.data.scope === 'SITE' && target.siteAdmin?.active) {
        await tx.siteAdmin.updateMany({ where: { userId: target.id, active: true }, data: { active: false, permissions: [] } })
        await tx.siteGovernanceEvent.create({ data: {
          actorUserId: admin.id, targetUserId: target.id, action: 'ADMIN_SUSPENDED_ON_SANCTION',
          beforePermissions: target.siteAdmin.permissions, afterPermissions: [], reason: parsed.data.reason,
        } })
      }
      await createNotifications(tx, [{
        recipientUserId: target.id, sourceKey: `sanction:${sanction.id}`, type: 'USER_SANCTIONED',
        title: '您的 ISH 账号受到限制', summary: '可查看处分依据、截止时间及向独立网站管理员申诉。', href: '/account/limited',
      }])
      const ownerId = getSiteOwnerUserId()
      if (ownerId && ownerId !== admin.id) await createNotifications(tx, [{
        recipientUserId: ownerId, sourceKey: `owner-sanction:${sanction.id}`, type: 'OWNER_SANCTIONED',
        title: '管理员处分了一个账号', summary: `${admin.displayName} 对 ${target.displayName} 作出账号处分；原始依据与撤销入口已留档。`,
        href: '/admin/sanctions',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'ALREADY_SANCTIONED') return { error: '此账号目前已有同类或更高范围的有效处分；请先核对处理记录。' }
    throw error
  }
  refreshSanctions()
  return { success: '账号处分已生效，本人和站主均收到站内提醒。' }
}

export async function appealUserSanctionAction(_previous: SanctionState, data: FormData): Promise<SanctionState> {
  const user = await getCurrentUser()
  if (!user) return { error: '请登录后查看并申诉本人处分。' }
  const id = uuid.safeParse(data.get('sanctionId'))
  const statement = z.string().trim().min(10, '请写至少 10 个字说明申诉依据。').max(2000).safeParse(data.get('statement'))
  if (!id.success) return { error: '处分记录无效。' }
  if (!statement.success) return { error: statement.error.issues[0].message }
  try {
    await db.$transaction(async tx => {
      const sanction = await tx.userSanction.findUnique({ where: { id: id.data }, select: { id: true, targetId: true, issuedById: true, reason: true } })
      if (!sanction || sanction.targetId !== user.id) throw new Error('NOT_OWNER')
      const appeal = await tx.userSanctionAppeal.create({ data: {
        sanctionId: sanction.id, appellantId: user.id, statement: statement.data, reasonSnapshot: sanction.reason,
      } })
      await tx.userSanctionAppealEvent.create({ data: { appealId: appeal.id, actorUserId: user.id, action: 'SUBMITTED', reason: statement.data } })
      const staff = await tx.siteAdmin.findMany({ where: { active: true, permissions: { has: 'SANCTION_APPEAL_REVIEW' } }, select: { userId: true } })
      const reviewers = new Set(staff.map(item => item.userId))
      const ownerId = getSiteOwnerUserId()
      if (ownerId) reviewers.add(ownerId)
      reviewers.delete(user.id)
      reviewers.delete(sanction.issuedById)
      await createNotifications(tx, [...reviewers].map(id => ({
        recipientUserId: id, sourceKey: `sanction-appeal:${appeal.id}`, type: 'SANCTION_APPEAL_SUBMITTED',
        title: '有账号处分申诉待独立核查', summary: '请核对原处分依据与申诉说明。', href: '/admin/sanction-appeals',
      })))
      if (reviewers.size === 0 && ownerId) await createNotifications(tx, [{
        recipientUserId: ownerId, sourceKey: `sanction-appeal-assignment:${appeal.id}`, type: 'SANCTION_APPEAL_ASSIGNMENT',
        title: '账号申诉缺少独立审查员', summary: '原处分人不能审核此申诉，请授权另一位网站管理员。', href: '/admin/staff',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_OWNER') return { error: '只能申诉自己的处分。' }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return { error: '这次处分已提交过申诉，可在下方查看进度。' }
    throw error
  }
  refreshSanctions()
  return { success: '申诉已送交独立网站管理员；原处分人不能审自己的案件。' }
}

export async function decideSanctionAppealAction(_previous: SanctionState, data: FormData): Promise<SanctionState> {
  const admin = await getCurrentAdmin('SANCTION_APPEAL_REVIEW')
  if (!admin) return { error: '您没有账号处分申诉审查权限。' }
  const id = uuid.safeParse(data.get('appealId'))
  const decision = z.enum(['UPHELD', 'REVOKED']).safeParse(data.get('decision'))
  const reason = z.string().trim().min(10, '请写至少 10 字处理依据。').max(2000).safeParse(data.get('reason'))
  if (!id.success || !decision.success || !reason.success) return { error: '请核对申诉、结论和至少 10 字处理依据。' }
  try {
    await db.$transaction(async tx => {
      const appeal = await tx.userSanctionAppeal.findUnique({ where: { id: id.data },
        select: { id: true, status: true, appellantId: true,
          sanction: { select: { id: true, targetId: true, issuedById: true, status: true } } } })
      if (!appeal || appeal.status !== 'PENDING') throw new Error('ALREADY_DECIDED')
      if (admin.id === appeal.appellantId || admin.id === appeal.sanction.issuedById) throw new Error('REVIEW_CONFLICT')
      if (decision.data === 'UPHELD' && appeal.sanction.status === 'REVOKED') throw new Error('ALREADY_REVOKED')
      const now = new Date()
      const updated = await tx.userSanctionAppeal.updateMany({ where: { id: appeal.id, status: 'PENDING' }, data: {
        status: 'RESOLVED', decision: decision.data, decisionReason: reason.data, reviewedById: admin.id, reviewedAt: now,
      } })
      if (updated.count !== 1) throw new Error('ALREADY_DECIDED')
      await tx.userSanctionAppealEvent.create({ data: { appealId: appeal.id, actorUserId: admin.id, action: decision.data, reason: reason.data } })
      if (decision.data === 'REVOKED' && appeal.sanction.status === 'ACTIVE') {
        await tx.userSanction.updateMany({ where: { id: appeal.sanction.id, status: 'ACTIVE' }, data: {
          status: 'REVOKED', revokedAt: now, revokedById: admin.id, revokeReason: reason.data,
        } })
        await tx.userSanctionEvent.create({ data: { sanctionId: appeal.sanction.id, actorUserId: admin.id, action: 'REVOKED_AFTER_APPEAL', reason: reason.data } })
      }
      await tx.userNotification.updateMany({ where: { sourceKey: `sanction-appeal:${appeal.id}`, readAt: null }, data: { readAt: now } })
      await createNotifications(tx, [{
        recipientUserId: appeal.appellantId, sourceKey: `sanction-appeal-result:${appeal.id}`, type: 'SANCTION_APPEAL_RESULT',
        title: decision.data === 'REVOKED' ? '账号处分申诉成立' : '账号处分申诉已审结',
        summary: '查看独立审查结论与处理依据。', href: '/account/limited',
      }])
      const ownerId = getSiteOwnerUserId()
      if (ownerId && ownerId !== admin.id) await createNotifications(tx, [{
        recipientUserId: ownerId, sourceKey: `owner-sanction-appeal:${appeal.id}`, type: 'OWNER_SANCTION_APPEAL_RESULT',
        title: '管理员处理了账号处分申诉', summary: `${admin.displayName} 已完成独立审查，原结果和依据留档。`, href: '/admin/sanction-appeals',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'ALREADY_DECIDED') return { error: '申诉已经处理，请刷新页面。' }
    if (error instanceof Error && error.message === 'REVIEW_CONFLICT') return { error: '原处分人或被处分者不能审核自己的申诉。' }
    if (error instanceof Error && error.message === 'ALREADY_REVOKED') return { error: '原处分已经撤销，请核实最新记录。' }
    throw error
  }
  refreshSanctions()
  return { success: decision.data === 'REVOKED' ? '已撤销处分，原决定与申诉记录保留。' : '已维持原处分并通知本人。' }
}

/** 站主可发现误操作后直接撤销管理员的处分；独立申诉仍不交回原处分人裁决。 */
export async function revokeUserSanctionAction(_previous: SanctionState, data: FormData): Promise<SanctionState> {
  const owner = await getCurrentUser()
  if (!owner || !isSiteOwner(owner.id)) return { error: '只有站主可以主动撤销网站账号处分。' }
  const id = uuid.safeParse(data.get('sanctionId'))
  const reason = z.string().trim().min(10).max(2000).safeParse(data.get('reason'))
  if (!id.success || !reason.success) return { error: '请填写有效的处分编号与至少 10 字撤销依据。' }
  try {
    await db.$transaction(async tx => {
      const sanction = await tx.userSanction.findUnique({ where: { id: id.data }, select: { id: true, targetId: true, status: true, issuedById: true } })
      if (!sanction || sanction.status !== 'ACTIVE') throw new Error('NOT_ACTIVE')
      const now = new Date()
      const changed = await tx.userSanction.updateMany({ where: { id: sanction.id, status: 'ACTIVE' }, data: {
        status: 'REVOKED', revokedAt: now, revokedById: owner.id, revokeReason: reason.data,
      } })
      if (changed.count !== 1) throw new Error('NOT_ACTIVE')
      await tx.userSanctionEvent.create({ data: { sanctionId: sanction.id, actorUserId: owner.id, action: 'OWNER_REVOKED', reason: reason.data } })
      const pending = await tx.userSanctionAppeal.findUnique({ where: { sanctionId: sanction.id }, select: { id: true, status: true } })
      if (pending?.status === 'PENDING') {
        await tx.userSanctionAppeal.update({ where: { id: pending.id }, data: {
          status: 'RESOLVED', decision: 'REVOKED', decisionReason: `站主主动撤销原处分：${reason.data}`,
          reviewedById: owner.id, reviewedAt: now,
        } })
        await tx.userSanctionAppealEvent.create({ data: { appealId: pending.id, actorUserId: owner.id,
          action: 'OWNER_REVOKED_ORIGINAL', reason: reason.data } })
        await tx.userNotification.updateMany({ where: { sourceKey: `sanction-appeal:${pending.id}`, readAt: null }, data: { readAt: now } })
      }
      await createNotifications(tx, [{
        recipientUserId: sanction.targetId, sourceKey: `sanction-owner-revoked:${sanction.id}`,
        type: 'SANCTION_REVOKED', title: '账号处分已撤销', summary: '站主已撤销处分；原决定和撤销依据仍可查看。', href: '/account/limited',
      }])
      if (sanction.issuedById !== owner.id) await createNotifications(tx, [{
        recipientUserId: sanction.issuedById, sourceKey: `sanction-owner-correction:${sanction.id}`,
        type: 'SANCTION_CORRECTED', title: '站主撤销了您作出的账号处分', summary: '请查看对应处分历史与撤销原因。', href: '/admin/sanctions',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_ACTIVE') return { error: '原处分已经撤销或记录无效，请刷新页面。' }
    throw error
  }
  refreshSanctions()
  return { success: '已撤销处分，通知双方并保留原始依据与纠错原因。' }
}
