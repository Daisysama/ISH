import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { getProject, modeLabel } from '@/lib/projects'

export const metadata = { title: '项目 · ISH' }

/**
 * 项目页。
 *
 * 要登录才能看，但**不限于发起人** —— 「让想法找到同行者」的前提就是
 * 别人看得见它。isOwner 只用来多打一个标记，不参与决定能不能看；
 * 等「改项目」做出来之后，它才会真的变成一道权限。
 *
 * Next.js 15 里动态路由的参数是个 Promise，要 await 之后才能取。
 */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { id } = await params
  const project = await getProject(id)
  // id 是从网址里来的，随手改一个字符就会查不到。这不是异常，是 404。
  if (!project) notFound()

  const isOwner = project.ownerId === user.id

  return (
    <div className="page">
      <Link href="/dashboard" className="back-link">
        ← 回工作台
      </Link>

      <article className="project-detail">
        <div className="project-card-top">
          <span className={`tag tag-${project.mode}`}>
            {modeLabel(project.mode)}
          </span>
          <span className="tag">{project.category}</span>
          {isOwner && <span className="tag tag-owner">我发起的</span>}
        </div>

        <h1 className="display">{project.title}</h1>

        {/* 正文直接当文本渲染，React 会自动转义 —— 别人写的内容不能当 HTML 塞进页面。
            换行靠 CSS 的 white-space: pre-wrap 保留，而不是把字符串按 \n 切开再插 <br>：
            后者等于自己手写一遍转义逻辑，漏一个地方就是一个 XSS。 */}
        <p className="project-body">{project.summary}</p>

        <section className="project-section">
          <h2>需要什么样的同行者</h2>
          <div className="project-needs">
            {project.needs.map((n) => (
              <span key={n} className="need need-lg">
                {n}
              </span>
            ))}
          </div>
        </section>

        <footer className="project-card-foot project-foot">
          <span className="avatar">{project.owner.displayName.slice(0, 1)}</span>
          <div>
            <div>{project.owner.displayName} 发起</div>
            <div className="app-user-email">
              {project.createdAt.toLocaleDateString('zh-CN')}
            </div>
          </div>
        </footer>
      </article>

      <div className="next-up">
        <span className="wip-badge">下一步</span>
        <p>
          「愿同行」还没做 —— 别人现在看得到这个项目，但还没法申请加入。
          等结伴、立契接上之后，这里会长出申请列表和契约。
        </p>
      </div>
    </div>
  )
}
