/** 网站管理权限。站主天然拥有全部能力，管理员只拥有显式勾选的项。 */
export const SITE_PERMISSION_OPTIONS = [
  { value: 'PROJECT_REVIEW', label: '项目审核', description: '审核首次发布与修改再审。' },
  { value: 'APPEAL_REVIEW', label: '独立申诉审查', description: '处理与本人无利益冲突的同行移出申诉。' },
  { value: 'APPEAL_CORRECTION', label: '申诉裁决纠错', description: '撤销他人且与本人无利益冲突的裁决，并留痕重新审查；须同时拥有申诉审查权限。' },
  { value: 'GOVERNANCE_LOG_VIEW', label: '查看授权日志', description: '只读查看站主的授权与撤销记录。' },
  { value: 'CONTENT_POLICY', label: '内容筛查规则', description: '维护自动筛查规则并写明变更原因。' },
  { value: 'REPORT_REVIEW', label: '举报审查', description: '独立处理公开内容举报，不能审自己或本人项目的举报。' },
  { value: 'ANNOUNCEMENT_PUBLISH', label: '全站公告', description: '创建及发布站点公告；所有操作有版本与站主提醒。' },
  { value: 'USER_SANCTION', label: '用户处分', description: '有依据地限制用户发布或账号操作；永久处分仅站主可执行。' },
  { value: 'SANCTION_APPEAL_REVIEW', label: '封号申诉审查', description: '处理未由本人作出、也与本人无关的账号处分申诉。' },
] as const

export type SitePermission = (typeof SITE_PERMISSION_OPTIONS)[number]['value']
export const SITE_PERMISSIONS = SITE_PERMISSION_OPTIONS.map(option => option.value)
