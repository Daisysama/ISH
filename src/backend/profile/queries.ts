import { db } from '@/backend/database/client'

export function getUserProfile(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      email: true,
      skillTags: true,
      likeTags: true,
      dislikeTags: true,
      profileBio: true,
      experienceText: true,
      portfolioUrl: true,
    },
  })
}
