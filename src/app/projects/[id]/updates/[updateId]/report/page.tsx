import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { UpdateReportForm } from '@/frontend/components/governance/UpdateReportForm'

export const metadata = { title: '举报项目动态 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ReportProjectUpdatePage({ params, searchParams }: {
  params: Promise<{ id: string; updateId: string }>
  searchParams: Promise<{ from?: string | string[]; projectFrom?: string | string[] }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const { id, updateId } = await params
  const update = await db.projectUpdate.findFirst({ where: { id: updateId, projectId: id, status: 'PUBLISHED' },
    select: { title: true, authorId: true, project: { select: { title: true, creatorId: true } } } })
  if (!update || update.authorId === user.id || update.project.creatorId === user.id) notFound()
  const query = await searchParams
  const origin = Array.isArray(query.from) ? query.from[0] : query.from
  const rawProjectFrom = Array.isArray(query.projectFrom) ? query.projectFrom[0] : query.projectFrom
  const from = origin === 'dashboard' || origin === 'notifications' ? origin : 'detail'
  const projectFrom = rawProjectFrom === 'dashboard' ? 'dashboard' : 'projects'
  return <><GlobalHeader /><main className="team-page-shell shell-with-header update-page">
    <Link className="page-breadcrumb" href={`/projects/${id}/updates?from=${from}&projectFrom=${projectFrom}`}>← 项目动态</Link>
    <section className="panel governance-panel"><span className="eyebrow">REPORT A PROBLEM</span><h1>向网站举报这条动态</h1>
      <p>项目「{update.project.title}」 · {update.title}</p><UpdateReportForm projectId={id} updateId={updateId} />
    </section>
  </main></>
}
