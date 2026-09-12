'use client'

import { useActionState } from 'react'

import { saveProfileAction } from '@/backend/profile/actions'
import {
  PROFILE_INTEREST_OPTIONS,
  PROFILE_LIMITS,
  PROFILE_SKILL_OPTIONS,
} from '@/core/profile/user-profile'
import type { ProfileFormState } from '@/shared/profile'

type ProfileData = {
  skillTags: string[]
  likeTags: string[]
  dislikeTags: string[]
  profileBio: string | null
  experienceText: string | null
  portfolioUrl: string | null
}

function ProfileChip({
  name,
  value,
  checked,
}: {
  name: string
  value: string
  checked: boolean
}) {
  return (
    <label className="choice-chip">
      <input defaultChecked={checked} name={name} type="checkbox" value={value} />
      <span>{value}</span>
    </label>
  )
}

export function ProfileForm({ profile }: { profile: ProfileData }) {
  const customSkills = profile.skillTags.filter((tag) => !PROFILE_SKILL_OPTIONS.includes(tag as (typeof PROFILE_SKILL_OPTIONS)[number]))
  const customLikes = profile.likeTags.filter((tag) => !PROFILE_INTEREST_OPTIONS.includes(tag as (typeof PROFILE_INTEREST_OPTIONS)[number]))
  const customDislikes = profile.dislikeTags.filter((tag) => !PROFILE_INTEREST_OPTIONS.includes(tag as (typeof PROFILE_INTEREST_OPTIONS)[number]))
  const [state, action, isPending] = useActionState<ProfileFormState, FormData>(
    saveProfileAction,
    {},
  )

  return (
    <form action={action} className="profile-form">
      {state.error && <div className="form-error" role="alert">{state.error}</div>}
      {state.success && <div className="notice notice-success" role="status">{state.success}</div>}

      <section className="form-section">
        <div className="form-section-heading">
          <span>01</span>
          <div><h2>我会什么</h2><p>这些是自述标签，不代表 ISH 对能力做过认证。</p></div>
        </div>
        <div className="choice-grid">
          {PROFILE_SKILL_OPTIONS.map((option) => (
            <ProfileChip key={option} name="skillTags" value={option} checked={profile.skillTags.includes(option)} />
          ))}
        </div>
        <div className="field field-compact"><label htmlFor="customSkillTags">其他技能</label><input id="customSkillTags" name="customSkillTags" type="text" defaultValue={customSkills.join('、')} placeholder="例如：Ren'Py、Blender、技术美术" /><span className="hint">逗号分隔，最多补充 5 个。</span></div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>02</span>
          <div><h2>我喜欢什么</h2><p>选你愿意多看到的东西。以后推荐会优先照顾这些口味。</p></div>
        </div>
        <div className="choice-grid">
          {PROFILE_INTEREST_OPTIONS.map((option) => (
            <ProfileChip key={option} name="likeTags" value={option} checked={profile.likeTags.includes(option)} />
          ))}
        </div>
        <div className="field field-compact"><label htmlFor="customLikeTags">还有别的偏好吗？</label><input id="customLikeTags" name="customLikeTags" type="text" defaultValue={customLikes.join('、')} placeholder="例如：时间循环、群像、经营建设" /></div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>03</span>
          <div><h2>我不太想看什么</h2><p>只会降低推荐权重，不会阻止你主动搜索和访问。</p></div>
        </div>
        <div className="choice-grid">
          {PROFILE_INTEREST_OPTIONS.map((option) => (
            <ProfileChip key={option} name="dislikeTags" value={option} checked={profile.dislikeTags.includes(option)} />
          ))}
        </div>
        <div className="field field-compact"><label htmlFor="customDislikeTags">还有哪些雷点？</label><input id="customDislikeTags" name="customDislikeTags" type="text" defaultValue={customDislikes.join('、')} placeholder="例如：重度跳脸、强制 PvP" /></div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>04</span>
          <div><h2>再介绍一点自己</h2><p>完全选填。想找同行时，一点真实经历会比一句“我会”更有帮助。</p></div>
        </div>

        <div className="field">
          <label htmlFor="profileBio">一句自我介绍</label>
          <textarea id="profileBio" name="profileBio" rows={3} maxLength={PROFILE_LIMITS.bioMax} defaultValue={profile.profileBio ?? ''} placeholder="例如：独立游戏爱好者，平时做前端，也喜欢玩视觉小说。" />
        </div>

        <div className="field">
          <label htmlFor="experienceText">项目经历 / 作品经历</label>
          <textarea id="experienceText" name="experienceText" rows={5} maxLength={PROFILE_LIMITS.experienceMax} defaultValue={profile.experienceText ?? ''} placeholder="写做过什么即可，不需要像简历。" />
        </div>

        <div className="field">
          <label htmlFor="portfolioUrl">作品集 / GitHub / 主页链接</label>
          <input id="portfolioUrl" name="portfolioUrl" type="url" defaultValue={profile.portfolioUrl ?? ''} placeholder="https://..." />
        </div>
      </section>

      <div className="profile-submit-row">
        <p>这些资料由你自行填写，ISH 暂不做能力认证。</p>
        <button className="button button-primary" type="submit" disabled={isPending}>
          {isPending ? '正在保存…' : '保存我的画像'}
        </button>
      </div>
    </form>
  )
}
