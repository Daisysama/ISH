import { db } from '@/backend/database/client'

export function getUserProfile(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      uid: true,
      displayName: true,
      email: true,
      skillTags: true,
      likeTags: true,
      dislikeTags: true,
      profileBio: true,
      experienceText: true,
      portfolioUrl: true,
      publicProfileEnabled: true,
      suppressInterestedPrompt: true,
      suppressNotInterestedPrompt: true,
      tagSignals: { where: { score: { not: 0 } }, orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }], select: { tag: true, score: true } },
    },
  })
}
