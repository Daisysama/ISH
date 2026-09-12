/** 项目内部授权不同于网站 ADMIN；同行者没有隐式的发布或管理权限。 */
export const MEMBER_PERMISSION_OPTIONS = [
  { value: 'SUBMIT_UPDATES', label: '提交项目动态', description: '可以代表项目提交对外动态；网站审核通过后才公开。' },
] as const

export type MemberPermission = (typeof MEMBER_PERMISSION_OPTIONS)[number]['value']
export const MEMBER_PERMISSIONS = MEMBER_PERMISSION_OPTIONS.map(item => item.value)
