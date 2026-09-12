import { z } from 'zod'

import { PROJECT_TYPE_OPTIONS, SEEKING_ROLE_OPTIONS } from '@/core/meow/project'

export const PROFILE_LIMITS = {
  tagMax: 24,
  tagMaxCount: 20,
  bioMax: 300,
  experienceMax: 1500,
  portfolioUrlMax: 500,
} as const

export const PROFILE_INTEREST_OPTIONS = [
  ...PROJECT_TYPE_OPTIONS,
  '科幻',
  '奇幻',
  '百合',
  '悬疑',
  '治愈',
  '剧情向',
] as const

export const PROFILE_SKILL_OPTIONS = [
  ...SEEKING_ROLE_OPTIONS,
  'Unity',
  'Unreal Engine',
  'Godot',
  "Ren'Py",
  'Live2D',
] as const

const optionalUrl = z
  .string()
  .trim()
  .max(PROFILE_LIMITS.portfolioUrlMax, '作品链接太长了')
  .refine((value) => value === '' || /^https?:\/\//i.test(value), '作品链接请以 http:// 或 https:// 开头')
  .transform((value) => (value === '' ? undefined : value))

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}


export function parseProfileCustomTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string') return []
  return dedupe(raw.split(/[,，、;；\n]+/)).slice(0, 5)
}

export function mergeProfileTags(selected: string[], custom: string[]): string[] {
  return dedupe([...selected, ...custom]).slice(0, PROFILE_LIMITS.tagMaxCount)
}

export function readProfileTags(formData: FormData, name: string): string[] {
  return dedupe(
    formData
      .getAll(name)
      .filter((value): value is string => typeof value === 'string'),
  ).slice(0, PROFILE_LIMITS.tagMaxCount)
}

export const userProfileSchema = z.object({
  skillTags: z.array(z.string().trim().min(1).max(PROFILE_LIMITS.tagMax)).max(PROFILE_LIMITS.tagMaxCount),
  likeTags: z.array(z.string().trim().min(1).max(PROFILE_LIMITS.tagMax)).max(PROFILE_LIMITS.tagMaxCount),
  dislikeTags: z.array(z.string().trim().min(1).max(PROFILE_LIMITS.tagMax)).max(PROFILE_LIMITS.tagMaxCount),
  profileBio: z
    .string()
    .trim()
    .max(PROFILE_LIMITS.bioMax, `自我介绍最多 ${PROFILE_LIMITS.bioMax} 个字`)
    .transform((value) => (value === '' ? undefined : value)),
  experienceText: z
    .string()
    .trim()
    .max(PROFILE_LIMITS.experienceMax, `项目经历最多 ${PROFILE_LIMITS.experienceMax} 个字`)
    .transform((value) => (value === '' ? undefined : value)),
  portfolioUrl: optionalUrl,
})

export type UserProfileInput = z.infer<typeof userProfileSchema>
