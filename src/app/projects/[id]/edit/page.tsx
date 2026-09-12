import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { getProjectRevisionEditorState } from '@/backend/revisions/queries'
import { getProjectRevisionChanges, projectSnapshotToFormValues } from '@/core/meow/revision'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { MeowForm } from '@/frontend/components/projects/MeowForm'

export const metadata = { title: '修改项目 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ submitted?: string | string[] }>
}

export default async function EditProjectPage({ params, searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { id } = await params
  const query = await searchParams
  const project = await getProjectRevisionEditorState(id, user.id)
  if (!project) notFound()

  if (project.status !== 'PUBLISHED') {
    redirect(`/projects/${project.id}?from=dashboard`)
  }

  const revision = project.revisions[0] ?? null
  const pendingRevision = revision?.status === 'PENDING' ? revision : null
  const rejectedRevision = revision?.status === 'REJECTED' ? revision : null
  const submitted = (Array.isArray(query.submitted) ? query.submitted[0] : query.submitted) === '1'

  const formSource = rejectedRevision ?? project
  const initialValues = projectSnapshotToFormValues(formSource)
  const changes = pendingRevision ? getProjectRevisionChanges(project, pendingRevision) : []

  return (
    <>
      <GlobalHeader active="projects" />
      <main className="creative-shell shell-with-header revision-editor-shell">
        <Link className="page-breadcrumb" href="/dashboard">← 我的项目</Link>

        <div className="creative-layout revision-editor-layout">
          <aside className="meow-intro revision-intro">
            <span className="eyebrow">PROJECT REVISION / 修改再审</span>
            <h1>让项目继续长，但别让线上版本突然变样。</h1>
            <p>您可以放心修改。审核通过以前，羊群看到的仍然是当前公开版本 V{project.version}。</p>

            <div className="meow-steps">
              <div><span>01</span><strong>改一版</strong><p>从现在的公开内容开始改，不需要重新填写。</p></div>
              <div><span>02</span><strong>修改再审</strong><p>新版本单独进入审核，旧版本继续公开。</p></div>
              <div><span>03</span><strong>原子替换</strong><p>审核通过后，新版一次性替换公开内容。</p></div>
            </div>
          </aside>

          <section className="panel project-form-panel">
            <div className="form-panel-heading">
              <span className="eyebrow">当前公开 V{project.version}</span>
              <h2>{pendingRevision ? `V${pendingRevision.version} 正在审核` : rejectedRevision ? `继续修改 V${rejectedRevision.version}` : `准备 V${project.version + 1}`}</h2>
              <p>{pendingRevision ? '当前公开版本不会受影响。审核结束后，您可以继续修改或直接上线新版。' : '这里只改下一版，不会直接覆盖大家正在看的内容。'}</p>
            </div>

            {submitted && pendingRevision && (
              <div className="notice notice-success revision-status-notice">
                <strong>修改已经送去审核。</strong> 线上 V{project.version} 继续公开，您不用等在这里。
              </div>
            )}

            {rejectedRevision?.rejectionReason && (
              <div className="notice notice-danger revision-status-notice">
                <strong>这版修改被退回：</strong> {rejectedRevision.rejectionReason}
              </div>
            )}

            {pendingRevision ? (
              <div className="revision-pending-preview">
                <div className="revision-pending-heading">
                  <div>
                    <span className="eyebrow">WAITING FOR REVIEW</span>
                    <h3>这份修改正在审核，暂时不再编辑。</h3>
                  </div>
                  <Link className="button button-quiet button-compact" href={`/projects/${project.id}?from=dashboard`}>
                    看当前线上版
                  </Link>
                </div>

                {changes.length === 0 ? (
                  <p className="revision-no-change">这份提交和当前线上版本没有可见差异。</p>
                ) : (
                  <div className="revision-change-list">
                    {changes.map((change) => (
                      <div className="revision-change-row" key={change.key}>
                        <strong>{change.label}</strong>
                        <div><span>线上 V{project.version}</span><p>{change.before}</p></div>
                        <div><span>待审 V{pendingRevision.version}</span><p>{change.after}</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <MeowForm
                mode="revision"
                projectId={project.id}
                revisionId={rejectedRevision?.id}
                initialValues={initialValues}
              />
            )}
          </section>
        </div>
      </main>
    </>
  )
}
