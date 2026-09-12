import Link from 'next/link'

import { projectHref } from '@/shared/navigation'

import { removeFavoriteProjectFormAction } from '@/backend/profile/preference-actions'

type FavoriteProject = {
  projectId: string
  project: { title: string; summary: string }
}

export function FavoriteProjectsPanel({ projects }: { projects: FavoriteProject[] }) {
  return (
    <section className="panel hidden-projects-panel">
      <div className="form-section-heading">
        <span>06</span>
        <div>
          <h2>我的收藏</h2>
          <p>留着以后慢慢看。收藏是您的私人书签，单个用户的收藏行为不会公开展示。</p>
        </div>
      </div>
      {projects.length === 0 ? (
        <p className="hint">暂时还没有收藏项目。</p>
      ) : (
        <div className="hidden-project-list">
          {projects.map((item) => (
            <div className="hidden-project-row" key={item.projectId}>
              <div>
                <strong><Link href={projectHref(item.projectId, 'profile')}>{item.project.title}</Link></strong>
                <p>{item.project.summary}</p>
              </div>
              <form action={removeFavoriteProjectFormAction}>
                <input name="projectId" type="hidden" value={item.projectId} />
                <button className="button button-quiet button-compact" type="submit">取消收藏</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
