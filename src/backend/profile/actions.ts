'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { getWritingUser } from '@/backend/auth/write-access'
import { db } from '@/backend/database/client'
import {
  mergeProfileTags,
  parseProfileCustomTags,
  readProfileTags,
  userProfileSchema,
} from '@/core/profile/user-profile'
import type { ProfileFormState } from '@/shared/profile'

export async function saveProfileAction(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getWritingUser('POSTING')
  if (!user) redirect('/login')

  const removeSignal = String(formData.get('removeSignal') ?? '').trim()
  if (removeSignal) {
    await db.userTagSignal.deleteMany({ where: { userId: user.id, tag: removeSignal } })
    revalidatePath('/profile')
    revalidatePath('/projects')
    return { success: `已经不再根据“${removeSignal}”判断您的口味。` }
  }

  const parsed = userProfileSchema.safeParse({
    skillTags: mergeProfileTags(readProfileTags(formData, 'skillTags'), parseProfileCustomTags(formData.get('customSkillTags'))),
    likeTags: mergeProfileTags(readProfileTags(formData, 'likeTags'), parseProfileCustomTags(formData.get('customLikeTags'))),
    dislikeTags: mergeProfileTags(readProfileTags(formData, 'dislikeTags'), parseProfileCustomTags(formData.get('customDislikeTags'))),
    profileBio: formData.get('profileBio') ?? '',
    experienceText: formData.get('experienceText') ?? '',
    portfolioUrl: formData.get('portfolioUrl') ?? '',
    publicProfileEnabled: formData.get('publicProfileEnabled') === 'on',
    askInterestedDetails: formData.get('askInterestedDetails') === 'on',
    askNotInterestedDetails: formData.get('askNotInterestedDetails') === 'on',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '资料没有保存，请检查输入。' }
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      skillTags: parsed.data.skillTags,
      likeTags: parsed.data.likeTags,
      dislikeTags: parsed.data.dislikeTags,
      profileBio: parsed.data.profileBio ?? null,
      experienceText: parsed.data.experienceText ?? null,
      portfolioUrl: parsed.data.portfolioUrl ?? null,
      publicProfileEnabled: parsed.data.publicProfileEnabled,
      suppressInterestedPrompt: !parsed.data.askInterestedDetails,
      suppressNotInterestedPrompt: !parsed.data.askNotInterestedDetails,
    },
  })

  await db.userTagSignal.deleteMany({ where: { userId: user.id, tag: { in: [...parsed.data.likeTags, ...parsed.data.dislikeTags] } } })

  revalidatePath('/profile')
  revalidatePath(`/users/${user.id}`)
  revalidatePath('/projects')
  revalidatePath('/')
  return { success: '资料已经保存。以后推荐会更懂您一点。' }
}
