type RecordedSanction = { scope: string; status: string; expiresAt: Date | null }

/** 仅实际作出且尚未撤销的处分计入色阶；未核实举报、撤销记录不算“违规”。 */
export function classifyUserRecord(sanctions: RecordedSanction[], now = new Date(), upheldContentFindings = 0) {
  const confirmed = sanctions.filter(item => item.status === 'ACTIVE')
  const current = confirmed.filter(item => !item.expiresAt || item.expiresAt > now)
  if (current.some(item => item.scope === 'SITE')) return { label: '全站停用中', tone: 'site' as const }
  if (current.length) return { label: '限制中', tone: 'restricted' as const }
  if (confirmed.length + upheldContentFindings >= 2) return { label: '多次已确认处置', tone: 'repeated' as const }
  if (confirmed.length + upheldContentFindings === 1) return { label: '有已确认处置', tone: 'history' as const }
  return { label: '暂无有效处分', tone: 'regular' as const }
}
