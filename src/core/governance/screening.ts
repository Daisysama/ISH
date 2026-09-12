import { createHash } from 'node:crypto'

/** 规则和正文经过完全相同的兼容字符、大小写与分隔符归一化。规则只能填文字，拒绝执行正则。 */
export function normalizeScreeningText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

export type ActiveScreeningRule = { id: string; phrase: string; action: 'REVIEW' | 'BLOCK'; version: number }

export function scanProjectText(title: string, body: string, rules: ActiveScreeningRule[]) {
  // 标题和正文分别匹配，防止两个字段拼接后偶然组成一个从未写出的词。
  const segments = [title, body].map(normalizeScreeningText)
  const matches = rules.filter(rule => {
    const needle = normalizeScreeningText(rule.phrase)
    return needle.length >= 2 && segments.some(segment => segment.includes(needle))
  }).map(rule => ({ id: rule.id, phrase: rule.phrase, action: rule.action, version: rule.version }))
  const result = matches.some(match => match.action === 'BLOCK') ? 'BLOCK' as const
    : matches.length ? 'REVIEW' as const : 'CLEAR' as const
  return {
    result, matches,
    textHash: createHash('sha256').update(`${title}\n${body}`, 'utf8').digest('hex'),
  }
}
