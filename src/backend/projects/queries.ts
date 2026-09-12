import { db } from '@/backend/database/client'

export type ProjectDiscoveryFilters = {
  stage?: string
  purpose?: string
  typeTag?: string
  sort?: 'recommended' | 'newest' | 'oldest'
}

export type DiscoveryProfile = {
  skillTags: string[]
  likeTags: string[]
  dislikeTags: string[]
}

function hasAny(haystack: string[], needles: string[]) {
  const set = new Set(haystack)
  return needles.some((value) => set.has(value))
}

function recommendationScore(
  project: {
    typeTags: string[]
    seekingTags: string[]
    audience: 'EVERYONE' | 'COLLABORATORS' | 'PLAYERS'
    publishedAt: Date | null
  },
  profile: DiscoveryProfile | null,
) {
  if (!profile) return project.publishedAt?.getTime() ?? 0

  let score = 0
  if (hasAny(project.typeTags, profile.likeTags)) score += 8
  if (hasAny(project.typeTags, profile.dislikeTags)) score -= 10
  if (hasAny(project.seekingTags, profile.skillTags)) score += 6
  if (project.audience === 'COLLABORATORS' && profile.skillTags.length > 0) score += 2
  if (project.audience === 'PLAYERS' && profile.likeTags.length > 0) score += 2
  if (project.audience === 'EVERYONE') score += 1

  // 新鲜度只做轻量 tie-breaker，不让“新”压过真正的兴趣匹配。
  const ageDays = project.publishedAt
    ? Math.max(0, (Date.now() - project.publishedAt.getTime()) / 86_400_000)
    : 365
  score += Math.max(0, 2 - ageDays / 7)

  return score
}

export async function listPublishedProjects(
  filters: ProjectDiscoveryFilters = {},
  profile: DiscoveryProfile | null = null,
) {
  const projects = await db.project.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      summary: true,
      stage: true,
      purpose: true,
      audience: true,
      typeTags: true,
      seekingTags: true,
      platforms: true,
      publishedAt: true,
      creator: {
        select: { displayName: true },
      },
    },
  })

  const filtered = projects.filter((project) => {
    if (filters.stage && project.stage !== filters.stage) return false
    if (filters.purpose && project.purpose !== filters.purpose) return false
    if (filters.typeTag && !project.typeTags.includes(filters.typeTag)) return false
    return true
  })

  const sort = filters.sort ?? (profile ? 'recommended' : 'newest')

  return filtered.sort((a, b) => {
    if (sort === 'oldest') {
      return (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0)
    }
    if (sort === 'recommended') {
      return recommendationScore(b, profile) - recommendationScore(a, profile)
    }
    return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
  })
}

export function listProjectsForCreator(creatorId: string) {
  return db.project.findMany({
    where: { creatorId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      summary: true,
      stage: true,
      purpose: true,
      audience: true,
      typeTags: true,
      seekingTags: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      publishedAt: true,
    },
  })
}

export function getProjectById(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      creator: {
        select: {
          id: true,
          displayName: true,
        },
      },
      moderationEvents: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          action: true,
          note: true,
          createdAt: true,
        },
      },
    },
  })
}
