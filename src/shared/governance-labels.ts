/** 数据库存稳定代码；界面面向使用者统一使用中文，并同时展示稳定用户 ID。 */
export const PROJECT_REPORT_CATEGORIES = {
  STOLEN_WORK: '盗用作品', UNLICENSED_ASSETS: '疑似未经授权的素材', FAKE_PROJECT: '虚假项目',
  MISLEADING_TAGS: '标签与项目不符', CONTENT_VIOLATION: '内容违规', OTHER: '其他问题',
} as const

export const SANCTION_SCOPE_LABELS = {
  POSTING: '限制公开发布（旧版处分）', ACCOUNT: '限制发布与项目管理（旧版处分）',
  COMMENTS: '禁止公开评论和回复', PROJECTS: '禁止发布项目及项目动态',
  RESPONSES: '禁止响应项目', SITE: '停用站内行为（保留本人申诉与消息）',
} as const

export const UPDATE_REPORT_CATEGORIES = {
  HARASSMENT: '骚扰或攻击', MISLEADING: '虚假或误导', RIGHTS: '作品或贡献权益', OTHER: '其他问题',
} as const

export const COMMENT_REPORT_CATEGORIES = {
  HARASSMENT: '辱骂或骚扰', MISLEADING: '虚假误导', RIGHTS: '作品及权益问题',
  CONTENT: '违规内容', OTHER: '其他问题',
} as const

export const GOVERNANCE_EVENT_LABELS: Record<string, string> = {
  CREATED: '创建草稿', EDITED: '修改草稿', EDITED_PUBLISHED: '修改已发布公告', PUBLISH: '发布公告', WITHDRAW: '撤回公告',
  DELETED: '删除公告', ANNOUNCEMENT_RESTORED: '站主恢复公告', PINNED: '置顶公告', UNPINNED: '取消公告置顶',
  ISSUED: '作出处分', REVOKED_AFTER_APPEAL: '申诉成立并撤销处分', OWNER_REVOKED: '站主撤销处分',
  SUBMITTED: '提交申请', UPHELD: '维持原决定', REVOKED: '撤销原决定', RESTORED: '恢复项目公开',
  OWNER_RESTORED: '站主恢复项目公开', OWNER_RESTORED_ORIGINAL: '站主撤销原下架',
}

/** 兼容历史 JSON 快照；所有管理界面避免展示英文枚举和字段名。 */
export function formatRuleSnapshot(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '无'
  const rule = value as Record<string, unknown>
  return `${String(rule.phrase ?? '')} · ${rule.action === 'BLOCK' ? '暂缓发布' : '人工审核'} · ${rule.active ? '启用' : '停用'} · 版本 ${String(rule.version ?? '?')}`
}

export function formatMatchedRules(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return '未命中词条'
  return value.map(item => formatRuleSnapshot({ ...item as object, active: true })).join('；')
}

export function formatProjectTags(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '未记录'
  const record = value as Record<string, unknown>
  const types = Array.isArray(record.typeTags) ? record.typeTags.join('、') : '无'
  const seeking = Array.isArray(record.seekingTags) ? record.seekingTags.join('、') : '无'
  return `项目类型：${types || '无'}；寻找同行：${seeking || '无'}`
}
