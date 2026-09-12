import Link from 'next/link'

import { projectHref } from '@/shared/navigation'

import { restoreHiddenProjectFormAction } from '@/backend/profile/preference-actions'

type HiddenProject = {
  projectId: string
  project: { title: string; summary: string }
}

export function HiddenProjectsPanel({ projects }: { projects: HiddenProject[] }) {
  return (
    <section className="panel hidden-projects-panel">
      <div className="form-section-heading">
        <span>07</span>
        <div>
          <h2>我隐藏过的项目</h2>
          <p>隐藏只影响您的羊群广场。想反悔，随时恢复。</p>
        </div>
      </div>
      {projects.length === 0 ? (
        <p className="hint">暂时没有隐藏的项目。</p>
      ) : (
        <div className="hidden-project-list">
          {projects.map((item) => (
            <div className="hidden-project-row" key={item.projectId}>
              <div>
                <strong><Link href={projectHref(item.projectId, 'profile')}>{item.project.title}</Link></strong>
                <p>{item.project.summary}</p>
              </div>
              <form action={restoreHiddenProjectFormAction}>
                <input name="projectId" type="hidden" value={item.projectId} />
                <button className="button button-quiet button-compact" type="submit">恢复显示</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
