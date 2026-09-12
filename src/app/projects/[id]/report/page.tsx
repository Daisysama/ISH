import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { SubmitProjectReportForm } from '@/frontend/components/governance/ProjectReportForms'

export const metadata = { title: '举报项目 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ProjectReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const project = await db.project.findUnique({ where: { id }, select: { id: true, title: true, status: true, creatorId: true } })
  if (!project || project.status !== 'PUBLISHED') notFound()
  return <><GlobalHeader /><main className="moderation-shell shell-with-header">
    <Link className="page-breadcrumb" href={`/projects/${id}`}>← 项目详情</Link>
    <span className="eyebrow">PROJECT SAFETY</span><h1>举报「{project.title}」</h1>
    <p>涉及盗用作品、素材授权、虚假项目、误导标签或违规内容，可向网站提出举报。发起人不能查看您的举报说明。</p>
    {!user ? <p>请<Link href="/login">登录</Link>后提交举报。</p> : user.id === project.creatorId ? <p>您是项目发起人，不能举报自己的项目。</p> :
      <section className="panel governance-panel"><SubmitProjectReportForm projectId={id} /></section>}
  </main></>
}
