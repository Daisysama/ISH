import { db } from '@/backend/database/client'

export type ProjectDiscoveryFilters = {
  stages?: string[]
  purposes?: string[]
  typeTags?: string[]
  sort?: 'recommended' | 'published' | 'interested' | 'favorites'
  direction?: 'desc' | 'asc'
}

export type DiscoveryProfile = {
  skillTags: string[]
  likeTags: string[]
  dislikeTags: string[]
  inferredTags?: { tag: string; score: number }[]
}

function overlapCount(haystack: string[], needles: string[]) {
  const set = new Set(haystack)
  return needles.reduce((count, value) => count + (set.has(value) ? 1 : 0), 0)
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
  const explicitLikeMatches = overlapCount(project.typeTags, profile.likeTags)
  const explicitDislikeMatches = overlapCount(project.typeTags, profile.dislikeTags)
  const skillMatches = overlapCount(project.seekingTags, profile.skillTags)

  // “猜您喜欢”优先看明确喜欢标签的重合度；明确雷点的负权重更高。
  score += explicitLikeMatches * 8
  score -= explicitDislikeMatches * 10
  score += skillMatches * 5
  for (const signal of profile.inferredTags ?? []) {
    if (project.typeTags.includes(signal.tag)) score += Math.max(-3, Math.min(3, signal.score))
  }
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
  hiddenProjectIds: string[] = [],
  blockedUserIds: string[] = [],
) {
  const projects = await db.project.findMany({
    where: { status: 'PUBLISHED', ...(hiddenProjectIds.length ? { id: { notIn: hiddenProjectIds } } : {}),
      ...(blockedUserIds.length ? { creatorId: { notIn: blockedUserIds } } : {}) },
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
        select: { id: true, uid: true, displayName: true },
      },
      _count: {
        select: {
          userPreferences: { where: { kind: 'INTERESTED' } },
          favoritedByUsers: true,
        },
      },
    },
  })

  const filtered = projects.filter((project) => {
    // OR within each filter group, AND across groups.
    if (filters.stages?.length && !filters.stages.includes(project.stage)) return false
    if (filters.purposes?.length && !filters.purposes.includes(project.purpose)) return false
    if (filters.typeTags?.length && !filters.typeTags.some((tag) => project.typeTags.includes(tag))) return false
    return true
  })

  const sort = filters.sort ?? (profile ? 'recommended' : 'published')
  const direction = filters.direction ?? 'desc'
  const factor = direction === 'asc' ? 1 : -1

  return filtered.sort((a, b) => {
    let aValue = 0
    let bValue = 0

    if (sort === 'recommended') {
      aValue = recommendationScore(a, profile)
      bValue = recommendationScore(b, profile)
    } else if (sort === 'interested') {
      aValue = a._count.userPreferences
      bValue = b._count.userPreferences
    } else if (sort === 'favorites') {
      aValue = a._count.favoritedByUsers
      bValue = b._count.favoritedByUsers
    } else {
      aValue = a.publishedAt?.getTime() ?? 0
      bValue = b.publishedAt?.getTime() ?? 0
    }

    if (aValue !== bValue) return (aValue - bValue) * factor

    // 主排序相同时，用发布时间做稳定 tie-breaker。
    return ((a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0)) * -1
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
      version: true,
      revisions: {
        where: { status: { in: ['PENDING', 'REJECTED'] } },
        orderBy: [{ version: 'desc' }, { submittedAt: 'desc' }],
        take: 1,
        select: {
          id: true,
          version: true,
          status: true,
          rejectionReason: true,
          submittedAt: true,
        },
      },
      memberships: {
        where: { status: 'ACTIVE' },
        orderBy: { joinedAt: 'asc' },
        select: {
          id: true,
          roles: true,
          joinedAt: true,
          user: { select: { id: true, displayName: true } },
        },
      },
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
          uid: true,
          displayName: true,
        },
      },
      updates: {
        where: { status: 'PUBLISHED' },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: 3,
        select: { id: true, title: true, body: true, authorId: true, authorNameSnapshot: true, publishedAt: true },
      },
      moderationEvents: {
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          action: true,
          reviewType: true,
          note: true,
          createdAt: true,
          revision: { select: { version: true } },
        },
      },
      revisions: {
        where: { status: { in: ['PENDING', 'REJECTED'] } },
        orderBy: [{ version: 'desc' }, { submittedAt: 'desc' }],
        take: 1,
        select: { id: true, version: true, status: true, rejectionReason: true },
      },
      memberships: {
        where: { status: 'ACTIVE' },
        select: { id: true },
      },
    },
  })
}
