/** 审核列表采用服务端统一的等待时长描述，避免不同队列各自排序。 */
export function formatWaitingTime(submittedAt: Date, now: Date) {
  const minutes = Math.max(0, Math.floor((now.getTime() - submittedAt.getTime()) / 60_000))
  if (minutes < 60) return `已等待 ${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `已等待 ${hours} 小时 ${minutes % 60} 分钟`
  const days = Math.floor(hours / 24)
  return `已等待 ${days} 天 ${hours % 24} 小时`
}
