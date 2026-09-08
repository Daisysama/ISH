import { redirect } from 'next/navigation'

import { ProjectForm } from '@/components/ProjectForm'
import { getCurrentUser } from '@/lib/auth'

export const metadata = { title: '发愿 · ISH' }

/**
 * 发愿页。
 *
 * 页面本身只负责标题和取当前用户，表单是客户端组件 —— 因为它要一边打字
 * 一边更新右边那张预览卡，这件事必须在浏览器里做。
 */
export default async function NewProjectPage() {
  // 名字是传给预览卡用的：填表的人应该看到「别人会看到什么」，
  // 而署名是那张卡的一部分。
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow">Idea</span>
        <h1 className="display">发愿</h1>
        <p className="lede">
          把想法立起来，让它自己去找同行的人。
          这一步只需要说清楚三件事：做什么、为什么、需要谁。
        </p>
      </header>

      <ProjectForm ownerName={user.displayName} />
    </div>
  )
}
