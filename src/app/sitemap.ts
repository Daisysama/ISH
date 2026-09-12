import type { MetadataRoute } from 'next'

import { db } from '@/backend/database/client'
import { SITE_URL } from '@/shared/site'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await db.project.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true, updatedAt: true },
  })

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/projects`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    ...projects.map((project) => ({
      url: `${SITE_URL}/projects/${project.id}`,
      lastModified: project.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
