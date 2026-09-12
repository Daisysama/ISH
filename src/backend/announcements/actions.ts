'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getCurrentAdmin, getSiteOwnerUserId, isSiteOwner } from '@/backend/auth/admin'
import { getWritingUser } from '@/backend/auth/write-access'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'

export type AnnouncementState = { error?: string; success?: string }
const uuid = z.string().uuid()

export async function createAnnouncementAction(_previous: AnnouncementState, data: FormData): Promise<AnnouncementState> {
  await getWritingUser('POSTING')
  const admin = await getCurrentAdmin('ANNOUNCEMENT_PUBLISH')
  if (!admin) return { error: '只有站主或获授权的网站管理员可以起草公告。' }
  const parsed = z.object({ title: z.string().trim().min(4, '标题至少 4 字。').max(100),
    body: z.string().trim().min(20, '公告正文至少 20 字。').max(5000),
  }).safeParse({ title: data.get('title'), body: data.get('body') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  await db.$transaction(async tx => {
    const item = await tx.siteAnnouncement.create({ data: { authorId: admin.id, title: parsed.data.title, body: parsed.data.body } })
    await tx.siteAnnouncementEvent.create({ data: {
      announcementId: item.id, actorUserId: admin.id, action: 'CREATED', titleSnapshot: item.title, bodySnapshot: item.body, reason: '创建公告草稿',
    } })
    const ownerId = getSiteOwnerUserId()
    if (ownerId && ownerId !== admin.id) await createNotifications(tx, [{
      recipientUserId: ownerId, sourceKey: `site-announcement-draft:${item.id}`, type: 'ANNOUNCEMENT_DRAFTED',
      title: '管理员起草了一条全站公告', summary: `${admin.displayName} 新建公告草稿，完整内容与依据可在公告管理页查看。`,
      href: '/admin/announcements',
    }])
  })
  revalidatePath('/admin/announcements')
  revalidatePath('/notifications')
  return { success: '草稿已保存。确认无误后可在下方发布。' }
}

/** 草稿与公开公告均可修订；公开版修改必须说明原因，原正文由只追加事件保留。 */
export async function editAnnouncementDraftAction(_previous: AnnouncementState, data: FormData): Promise<AnnouncementState> {
  await getWritingUser('POSTING')
  const admin = await getCurrentAdmin('ANNOUNCEMENT_PUBLISH')
  if (!admin) return { error: '您没有编辑网站公告的权限。' }
  const id = uuid.safeParse(data.get('announcementId'))
  const input = z.object({ title: z.string().trim().min(4).max(100), body: z.string().trim().min(20).max(5000) })
    .safeParse({ title: data.get('title'), body: data.get('body') })
  if (!id.success || !input.success) return { error: '请填写有效公告编号、4～100 字标题和 20～5000 字正文。' }
  const reason = z.string().trim().min(10, '修改已发布公告请写至少 10 字原因。').max(1000).safeParse(data.get('reason'))
  try {
    await db.$transaction(async tx => {
      const item = await tx.siteAnnouncement.findUnique({ where: { id: id.data } })
      if (!item || item.status === 'WITHDRAWN') throw new Error('NOT_EDITABLE')
      if (item.status === 'PUBLISHED' && !reason.success) throw new Error('NEED_REASON')
      if (!isSiteOwner(admin.id) && item.authorId !== admin.id) throw new Error('NOT_AUTHOR')
      if (item.title === input.data.title && item.body === input.data.body) throw new Error('NO_CHANGE')
      const changed = await tx.siteAnnouncement.updateMany({ where: { id: item.id, status: item.status, updatedAt: item.updatedAt },
        data: { title: input.data.title, body: input.data.body } })
      if (changed.count !== 1) throw new Error('NOT_DRAFT')
      await tx.siteAnnouncementEvent.create({ data: {
        announcementId: item.id, actorUserId: admin.id, action: item.status === 'PUBLISHED' ? 'EDITED_PUBLISHED' : 'EDITED',
        titleSnapshot: input.data.title, bodySnapshot: input.data.body,
        reason: item.status === 'PUBLISHED' && reason.success ? reason.data : '编辑尚未发布的草稿',
      } })
      const ownerId = getSiteOwnerUserId()
      if (ownerId && ownerId !== admin.id) await createNotifications(tx, [{
        recipientUserId: ownerId, sourceKey: `site-announcement-edited:${item.id}:${item.updatedAt.toISOString()}`,
        type: 'ANNOUNCEMENT_EDITED', title: item.status === 'PUBLISHED' ? '管理员修改了已发布公告' : '管理员修改了公告草稿',
        summary: `「${input.data.title}」有新版本，原文与修改依据在管理记录中。`,
        href: '/admin/announcements',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_EDITABLE') return { error: '公告已撤回或记录失效，不能继续修改。' }
    if (error instanceof Error && error.message === 'NEED_REASON') return { error: '已发布公告修改须填写至少 10 字原因。' }
    if (error instanceof Error && error.message === 'NOT_AUTHOR') return { error: '管理员只能修改自己起草的公告；站主可修改全部草稿。' }
    if (error instanceof Error && error.message === 'NO_CHANGE') return { error: '没有发现内容变化。' }
    throw error
  }
  revalidatePath('/admin/announcements')
  revalidatePath('/announcements')
  revalidatePath('/')
  return { success: '公告已更新；前一版本和修改原因留在网站操作记录中。' }
}

export async function changeAnnouncementStatusAction(_previous: AnnouncementState, data: FormData): Promise<AnnouncementState> {
  await getWritingUser('POSTING')
  const admin = await getCurrentAdmin('ANNOUNCEMENT_PUBLISH')
  if (!admin) return { error: '只有站主或获授权的网站管理员可以操作公告。' }
  const id = uuid.safeParse(data.get('announcementId'))
  const action = z.enum(['PUBLISH', 'WITHDRAW']).safeParse(data.get('action'))
  const reason = z.string().trim().min(10, '请填写至少 10 字处理理由。').max(1000).safeParse(data.get('reason'))
  if (!id.success || !action.success) return { error: '公告链接或操作无效。' }
  if (!reason.success) return { error: reason.error.issues[0].message }
  try {
    await db.$transaction(async tx => {
      const item = await tx.siteAnnouncement.findUnique({ where: { id: id.data } })
      if (!item || (action.data === 'PUBLISH' ? item.status !== 'DRAFT' : item.status !== 'PUBLISHED')) throw new Error('NOT_CURRENT')
      if (!isSiteOwner(admin.id) && item.authorId !== admin.id) throw new Error('NOT_AUTHOR')
      const now = new Date()
      const updated = await tx.siteAnnouncement.updateMany({
        where: { id: item.id, status: item.status },
        data: action.data === 'PUBLISH' ? { status: 'PUBLISHED', publishedAt: now } : { status: 'WITHDRAWN', withdrawnAt: now, pinnedAt: null },
      })
      if (updated.count !== 1) throw new Error('NOT_CURRENT')
      const event = await tx.siteAnnouncementEvent.create({ data: {
        announcementId: item.id, actorUserId: admin.id, action: action.data,
        titleSnapshot: item.title, bodySnapshot: item.body, reason: reason.data,
      } })
      const ownerId = getSiteOwnerUserId()
      if (ownerId && ownerId !== admin.id) await createNotifications(tx, [{
        recipientUserId: ownerId, sourceKey: `site-announcement:${event.id}`,
        type: 'OWNER_ANNOUNCEMENT_CHANGED', title: action.data === 'PUBLISH' ? '管理员发布了全站公告' : '管理员撤回了全站公告',
        summary: `${admin.displayName} 处理公告「${item.title}」；依据与历史已留档。`, href: '/admin/announcements',
      }])
      // 全员消息仅站主选择；日常公告固定出现在公开公告页，避免管理员批量打扰用户。
      if (action.data === 'PUBLISH' && isSiteOwner(admin.id) && data.get('notifyEveryone') === 'on') {
        const users = await tx.user.findMany({ select: { id: true } })
        for (let offset = 0; offset < users.length; offset += 400) {
          await createNotifications(tx, users.slice(offset, offset + 400).map(user => ({
            recipientUserId: user.id, sourceKey: `site-announcement:${item.id}`, type: 'SITE_ANNOUNCEMENT',
            title: `ISH 公告：${item.title}`, summary: item.body.slice(0, 140), href: `/announcements#announcement-${item.id}`,
          })))
        }
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_CURRENT') return { error: '公告状态已经变化，请刷新页面。' }
    if (error instanceof Error && error.message === 'NOT_AUTHOR') return { error: '管理员只能发布或撤回自己起草的公告；站主可纠正全部公告。' }
    throw error
  }
  revalidatePath('/admin/announcements')
  revalidatePath('/announcements')
  revalidatePath('/notifications')
  return { success: action.data === 'PUBLISH' ? '公告已发布，审计记录与站主提醒已保存。' : '公告已撤回，历史版本继续留档。' }
}

/** 公告从公共页面立即消失；正文与操作人只保存在站主可查的管理记录中。 */
export async function deleteAnnouncementAction(_previous: AnnouncementState, data: FormData): Promise<AnnouncementState> {
  await getWritingUser('POSTING')
  const admin = await getCurrentAdmin('ANNOUNCEMENT_PUBLISH')
  if (!admin) return { error: '您没有删除网站公告的权限。' }
  const id = uuid.safeParse(data.get('announcementId'))
  if (!id.success) return { error: '公告编号无效。' }
  try {
    await db.$transaction(async tx => {
      const item = await tx.siteAnnouncement.findUnique({ where: { id: id.data } })
      if (!item || item.status !== 'PUBLISHED') throw new Error('NOT_CURRENT')
      if (!isSiteOwner(admin.id) && item.authorId !== admin.id) throw new Error('NOT_AUTHOR')
      const changed = await tx.siteAnnouncement.updateMany({
        where: { id: item.id, status: 'PUBLISHED', updatedAt: item.updatedAt },
        data: { status: 'WITHDRAWN', withdrawnAt: new Date(), pinnedAt: null },
      })
      if (changed.count !== 1) throw new Error('NOT_CURRENT')
      const event = await tx.siteAnnouncementEvent.create({ data: {
        announcementId: item.id, actorUserId: admin.id, action: 'DELETED',
        titleSnapshot: item.title, bodySnapshot: item.body, reason: '从公开公告列表删除',
      } })
      const ownerId = getSiteOwnerUserId()
      if (ownerId && ownerId !== admin.id) await createNotifications(tx, [{
        recipientUserId: ownerId, sourceKey: `site-announcement-delete:${event.id}`,
        type: 'OWNER_ANNOUNCEMENT_CHANGED', title: '管理员删除了网站公告',
        summary: `${admin.displayName} 删除了公告「${item.title}」；站主可在公告管理页查看记录并恢复。`,
        href: '/admin/announcements',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_CURRENT') return { error: '公告已变化，请刷新页面重试。' }
    if (error instanceof Error && error.message === 'NOT_AUTHOR') return { error: '管理员只能删除自己发布的公告。' }
    throw error
  }
  revalidatePath('/announcements')
  revalidatePath('/admin/announcements')
  revalidatePath('/notifications')
  return { success: '公告已从公共页面删除。' }
}

/** 只有站主可以恢复；恢复不重置发布时间，也不会删除原有的删除记录。 */
export async function restoreDeletedAnnouncementAction(_previous: AnnouncementState, data: FormData): Promise<AnnouncementState> {
  await getWritingUser('POSTING')
  const admin = await getCurrentAdmin('ANNOUNCEMENT_PUBLISH')
  if (!admin || !isSiteOwner(admin.id)) return { error: '只有站主可以恢复已删除的公告。' }
  const id = uuid.safeParse(data.get('announcementId'))
  if (!id.success) return { error: '公告编号无效。' }
  try {
    await db.$transaction(async tx => {
      const item = await tx.siteAnnouncement.findUnique({ where: { id: id.data } })
      if (!item || item.status !== 'WITHDRAWN' || !item.publishedAt) throw new Error('NOT_CURRENT')
      const changed = await tx.siteAnnouncement.updateMany({
        where: { id: item.id, status: 'WITHDRAWN', updatedAt: item.updatedAt },
        data: { status: 'PUBLISHED', withdrawnAt: null, pinnedAt: null },
      })
      if (changed.count !== 1) throw new Error('NOT_CURRENT')
      await tx.siteAnnouncementEvent.create({ data: {
        announcementId: item.id, actorUserId: admin.id, action: 'ANNOUNCEMENT_RESTORED',
        titleSnapshot: item.title, bodySnapshot: item.body, reason: '站主恢复已删除公告的公开展示',
      } })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_CURRENT') return { error: '公告状态已变化，请刷新页面重试。' }
    throw error
  }
  revalidatePath('/announcements')
  revalidatePath('/admin/announcements')
  return { success: '公告已恢复公开，删除与恢复记录仍在管理端。' }
}

/** Pinning never overwrites the original published date or previous editorial events. */
export async function toggleAnnouncementPinAction(_previous: AnnouncementState, data: FormData): Promise<AnnouncementState> {
  await getWritingUser('POSTING')
  const admin = await getCurrentAdmin('ANNOUNCEMENT_PUBLISH')
  if (!admin) return { error: '您没有管理网站公告的权限。' }
  const id = uuid.safeParse(data.get('announcementId'))
  if (!id.success) return { error: '公告编号无效。' }
  try {
    await db.$transaction(async tx => {
      const item = await tx.siteAnnouncement.findUnique({ where: { id: id.data } })
      if (!item || item.status !== 'PUBLISHED') throw new Error('NOT_CURRENT')
      if (!isSiteOwner(admin.id) && item.authorId !== admin.id) throw new Error('NOT_AUTHOR')
      const pinnedAt = item.pinnedAt ? null : new Date()
      const changed = await tx.siteAnnouncement.updateMany({ where: { id: item.id, status: 'PUBLISHED', updatedAt: item.updatedAt },
        data: { pinnedAt } })
      if (!changed.count) throw new Error('NOT_CURRENT')
      const event = await tx.siteAnnouncementEvent.create({ data: {
        announcementId: item.id, actorUserId: admin.id, action: pinnedAt ? 'PINNED' : 'UNPINNED',
        titleSnapshot: item.title, bodySnapshot: item.body, reason: pinnedAt ? '将该公告置顶展示' : '取消该公告的置顶展示',
      } })
      const ownerId = getSiteOwnerUserId()
      if (ownerId && ownerId !== admin.id) await createNotifications(tx, [{
        recipientUserId: ownerId, sourceKey: `site-announcement-pin:${event.id}`,
        type: 'OWNER_ANNOUNCEMENT_PIN', title: pinnedAt ? '管理员置顶了网站公告' : '管理员取消了公告置顶',
        summary: `「${item.title}」的展示顺序已调整；操作人和原时间均已留档。`, href: '/admin/announcements',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_CURRENT') return { error: '公告状态或版本已变化，请刷新页面。' }
    if (error instanceof Error && error.message === 'NOT_AUTHOR') return { error: '只能置顶自己发布的公告；站主可以管理全部公告。' }
    throw error
  }
  revalidatePath('/admin/announcements')
  revalidatePath('/announcements')
  revalidatePath('/notifications')
  return { success: '公告展示顺序已更新，操作保留在公告历史中。' }
}
