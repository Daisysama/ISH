import Link from 'next/link'

/** 仅在已经验证的申请审核或有效项目团队中渲染；从不读取推测性偏好或邮箱。 */
export type CollaborationProfileData = {
  id: string
  uid: number
  displayName: string
  skillTags: string[]
  likeTags: string[]
  dislikeTags: string[]
  profileBio: string | null
  experienceText: string | null
  portfolioUrl: string | null
  projectMemberships: { roles: string[]; project: { id: string; title: string } }[]
}

export function CollaborationProfile({ user, currentProjectId, returnTo }: {
  user: CollaborationProfileData; currentProjectId: string; returnTo: string
}) {
  const others = user.projectMemberships.filter(item => item.project.id !== currentProjectId)
  return <section className="response-profile-snapshot collaboration-profile" aria-label={`${user.displayName} 的同行画像`}>
    <strong>{user.displayName} · UID {user.uid} 的自述画像</strong>
    <p>个人介绍：{user.profileBio || '暂未填写'}</p>
    <p>能力与方向：{user.skillTags.length ? user.skillTags.join(' · ') : '暂未填写'}</p>
    <p>喜欢的方向：{user.likeTags.length ? user.likeTags.join(' · ') : '暂未填写'}</p>
    <p>不太想看的方向：{user.dislikeTags.length ? user.dislikeTags.join(' · ') : '暂未填写'}</p>
    <p>经历与试玩：{user.experienceText || '暂未填写'}</p>
    <p>当前公开同行项目：{others.length ? others.map(item => item.project.title).join(' · ') : '暂无其他公开同行项目'}</p>
    {user.portfolioUrl && <p><a className="story-link" href={user.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow">查看作品链接 ↗</a></p>}
    <Link className="story-link" href={`/users/${user.uid}?${new URLSearchParams({ returnTo })}`}>查看公开资料 →</Link>
    <small>以上资料来自用户当前填写的画像，不代表 ISH 对能力或经历的认证。</small>
  </section>
}
