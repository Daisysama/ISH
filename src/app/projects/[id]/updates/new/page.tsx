import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { getProjectUpdatePageState, getRejectedUpdateDraft } from '@/backend/updates/queries'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { ProjectUpdateForm } from '@/frontend/components/updates/ProjectUpdateForm'

export const metadata = { title: '发项目动态 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function NewProjectUpdatePage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string | string[]; projectFrom?: string | string[]; timelineFrom?: string | string[]; revise?: string | string[] }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const { id } = await params
  const { from: rawFrom, projectFrom: rawProjectFrom, timelineFrom: rawTimelineFrom, revise: rawRevise } = await searchParams
  const source = Array.isArray(rawFrom) ? rawFrom[0] : rawFrom
  const from = source === 'dashboard' || source === 'timeline' ? source : 'detail'
  const projectFrom = (Array.isArray(rawProjectFrom) ? rawProjectFrom[0] : rawProjectFrom) === 'dashboard' ? 'dashboard' : 'projects'
  const timelineSource = Array.isArray(rawTimelineFrom) ? rawTimelineFrom[0] : rawTimelineFrom
  const timelineFrom = timelineSource === 'dashboard' || timelineSource === 'notifications' ? timelineSource : 'detail'
  const project = await getProjectUpdatePageState(id, user.id)
  if (!project || !project.canSubmit) notFound()
  const revise = Array.isArray(rawRevise) ? rawRevise[0] : rawRevise
  const draft = revise ? await getRejectedUpdateDraft(id, revise, user.id) : null
  const returnTarget = from === 'dashboard' ? { href: '/dashboard', label: '我的项目' }
    : from === 'timeline' ? { href: `/projects/${id}/updates?from=${timelineFrom}&projectFrom=${projectFrom}`, label: '项目动态' }
      : { href: `/projects/${id}?from=${projectFrom}`, label: '项目详情' }

  return (
    <>
      <GlobalHeader active="projects" />
      <main className="team-page-shell shell-with-header update-page">
        <Link className="page-breadcrumb" href={returnTarget.href}>← {returnTarget.label}</Link>
        <div className="team-page-heading">
          <div><span className="eyebrow">PROJECT UPDATES</span><h1>为「{project.title}」发一条动态</h1>
            <p>说清楚最近的进展和下一步。提交后先由网站管理员审核，通过才会进入公开时间线。</p></div>
        </div>
        {draft && <p className="notice notice-success">已带入原稿；此次提交会生成新审核记录，原退回记录继续保留。</p>}
        <section className="panel update-editor-panel"><ProjectUpdateForm projectId={id} from={from} projectFrom={projectFrom} timelineFrom={timelineFrom} initialTitle={draft?.title} initialBody={draft?.body} /></section>
      </main>
    </>
  )
}
