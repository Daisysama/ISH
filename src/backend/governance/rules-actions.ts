'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

import { getCurrentAdmin, getSiteOwnerUserId, isSiteOwner } from '@/backend/auth/admin'
import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { createNotifications } from '@/backend/notifications/write'
import { normalizeScreeningText } from '@/core/governance/screening'

export type RuleState = { error?: string; success?: string }

/** 只有站主可以改变「未命中即公开」的全局策略；默认始终由人工审核。 */
export async function setClearUpdatePolicyAction(_previous: RuleState, data: FormData): Promise<RuleState> {
  const owner = await getCurrentUser()
  if (!owner || !isSiteOwner(owner.id)) return { error: '只有站主可以调整未命中规则时的处理方式。' }
  const enabled = z.enum(['manual', 'publish']).safeParse(data.get('mode'))
  const reason = z.string().trim().min(10, '请填写至少 10 字调整原因。').max(1000).safeParse(data.get('reason'))
  if (!enabled.success || !reason.success) return { error: '请核对处理方式并填写 10～1000 字原因。' }
  if (enabled.data === 'publish' && data.get('acknowledgeRisks') !== 'on') {
    return { error: '请先确认：未命中词条并不意味着内容没有问题。' }
  }
  try {
    await db.$transaction(async tx => {
      const old = await tx.contentScreeningPolicy.findUnique({ where: { id: 'site' } })
      const next = enabled.data === 'publish'
      if ((old?.autoApproveClearUpdates ?? false) === next) throw new Error('UNCHANGED')
      await tx.contentScreeningPolicy.upsert({ where: { id: 'site' },
        create: { id: 'site', autoApproveClearUpdates: next, updatedById: owner.id },
        update: { autoApproveClearUpdates: next, updatedById: owner.id },
      })
      await tx.contentScreeningPolicyEvent.create({ data: {
        policyId: 'site', actorUserId: owner.id, before: old?.autoApproveClearUpdates ?? false,
        after: next, reason: reason.data,
      } })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNCHANGED') return { error: '处理方式没有变化。' }
    throw error
  }
  revalidatePath('/admin/content-rules')
  return { success: enabled.data === 'publish' ? '未命中规则的后续动态将自动公开，调整已留痕。' : '已恢复未命中内容人工审核。' }
}

/** 网站规则变动永远写审计事件，不能由项目发起人编辑。 */
export async function saveScreeningRuleAction(_previous: RuleState, data: FormData): Promise<RuleState> {
  const admin = await getCurrentAdmin('CONTENT_POLICY')
  if (!admin) return { error: '您没有维护网站内容规则的权限。' }
  const id = data.get('ruleId')
  const parsed = z.object({
    phrase: z.string().trim().min(2, '规则至少 2 个字。').max(80, '规则最多 80 个字。'),
    action: z.enum(['REVIEW', 'BLOCK']),
    reason: z.string().trim().min(10, '请写至少 10 个字说明调整原因。').max(500),
    version: z.coerce.number().int().nonnegative(),
  }).safeParse({ phrase: data.get('phrase'), action: data.get('action'), reason: data.get('reason'), version: data.get('version') ?? 0 })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const normalizedPhrase = normalizeScreeningText(parsed.data.phrase)
  if (normalizedPhrase.length < 2) return { error: '规则须包含至少两个有效的文字或数字。' }
  const active = data.get('active') === 'on'
  const existingId = id ? z.string().uuid().safeParse(id) : null
  if (id && !existingId?.success) return { error: '规则记录无效。' }
  try {
    await db.$transaction(async tx => {
      const old = existingId?.success ? await tx.screeningRule.findUnique({ where: { id: existingId.data } }) : null
      if (existingId?.success && !old) throw new Error('RULE_CHANGED')
      if (old && old.version !== parsed.data.version) throw new Error('RULE_CHANGED')
      if (old) {
        const changed = await tx.screeningRule.updateMany({ where: { id: old.id, version: parsed.data.version },
          data: { phrase: parsed.data.phrase, normalizedPhrase, action: parsed.data.action, active,
            version: { increment: 1 }, updatedById: admin.id } })
        if (changed.count !== 1) throw new Error('RULE_CHANGED')
      }
      const rule = old ? await tx.screeningRule.findUniqueOrThrow({ where: { id: old.id } }) : await tx.screeningRule.create({
        data: { phrase: parsed.data.phrase, normalizedPhrase, action: parsed.data.action,
          active: true, createdById: admin.id, updatedById: admin.id },
      })
      await tx.screeningRuleEvent.create({
        data: {
          ruleId: rule.id, actorUserId: admin.id, before: old ? { phrase: old.phrase, action: old.action, active: old.active, version: old.version } : undefined,
          after: { phrase: rule.phrase, action: rule.action, active: rule.active, version: rule.version }, reason: parsed.data.reason,
        },
      })
      const ownerId = getSiteOwnerUserId()
      if (ownerId && ownerId !== admin.id) await createNotifications(tx, [{
        recipientUserId: ownerId, sourceKey: `screening-rule:${rule.id}:${rule.version}`,
        type: 'SCREENING_RULE_CHANGED', title: '管理员调整了内容筛查规则',
        summary: `${admin.displayName} 调整了一条内容规则；变更原因与版本已留痕。`, href: '/admin/content-rules',
      }])
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'RULE_CHANGED') return { error: '这条规则已被他人更新，请刷新后再修改。' }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { error: '相同内容的规则已存在，请调整已有规则。' }
    throw error
  }
  revalidatePath('/admin/content-rules')
  revalidatePath('/notifications')
  return { success: '内容规则已保存，调整原因已记入治理记录。' }
}
