import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/shared/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/projects'],
      disallow: ['/admin/', '/dashboard', '/meow/', '/profile', '/login', '/register'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
