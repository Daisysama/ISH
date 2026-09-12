'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'

export type UserBlockState = { error?: string; success?: string }

export async function changeUserBlockAction(_previous: UserBlockState, data: FormData): Promise<UserBlockState> {
  const viewer = await getCurrentUser()
  if (!viewer) return { error: '请登录后管理自己的拉黑名单。' }
  const targetId = z.string().uuid().safeParse(data.get('targetUserId'))
  const operation = z.enum(['BLOCK', 'UNBLOCK']).safeParse(data.get('operation'))
  if (!targetId.success || !operation.success || targetId.data === viewer.id) return { error: '用户或操作无效；不能拉黑自己。' }
  try {
    await db.$transaction(async tx => {
      const target = await tx.user.findUnique({ where: { id: targetId.data }, select: { id: true } })
      if (!target) throw new Error('TARGET_MISSING')
      const old = await tx.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: targetId.data } } })
      const active = operation.data === 'BLOCK'
      if (!old && !active || old && old.active === active) throw new Error('NO_CHANGE')
      const block = old ? await tx.userBlock.update({ where: { id: old.id }, data: { active, clearedAt: active ? null : new Date() } })
        : await tx.userBlock.create({ data: { blockerId: viewer.id, blockedId: targetId.data } })
      await tx.userBlockEvent.create({ data: { blockId: block.id, actorUserId: viewer.id, action: operation.data } })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'TARGET_MISSING') return { error: '该用户已经不存在。' }
    if (error instanceof Error && error.message === 'NO_CHANGE') return { error: '拉黑状态已经改变，请刷新页面。' }
    throw error
  }
  revalidatePath('/profile/blocks')
  revalidatePath('/projects')
  revalidatePath('/projects/[id]', 'page')
  revalidatePath('/projects/[id]/updates', 'page')
  revalidatePath('/dashboard')
  return { success: operation.data === 'BLOCK' ? '已拉黑；您仍可通过网站举报或申诉。' : '已解除拉黑。' }
}
