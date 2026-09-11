import { db } from '@/backend/database/client'

export function listPublishedProjects() {
  return db.project.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      summary: true,
      publishedAt: true,
      creator: {
        select: { displayName: true },
      },
    },
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
