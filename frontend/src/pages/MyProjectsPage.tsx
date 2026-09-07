import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { Application, ProjectSummary } from '../api/types'
import { ErrorBox, Loading, PageHeader, ProjectCard, formatDate } from '../components/common'

export default function MyProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<ProjectSummary[]>('/api/projects', { mine: true }),
      api.get<Application[]>('/api/me/applications'),
    ])
      .then(([p, a]) => {
        setProjects(p)
        setApplications(a)
      })
      .catch((err) => setError(err.message))
  }, [])

  return (
    <>
      <PageHeader
        title="我的项目"
        subtitle="真实的项目事实，而不是「熟练掌握团队协作」。"
        actions={
          <button className="btn brand" onClick={() => navigate('/create')}>
            ＋ 发愿
          </button>
        }
      />
      <ErrorBox message={error} />

      {projects === null ? (
        <Loading what="项目" />
      ) : projects.length === 0 ? (
        <div className="empty">你还没有参与任何项目。去发现页找一个，或者自己发一个愿。</div>
      ) : (
        <div className="grid">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={(id) => navigate(`/projects/${id}`)}
            />
          ))}
        </div>
      )}

      {applications.length > 0 && (
        <>
          <h3 style={{ marginTop: 28 }}>我提交的申请</h3>
          <div className="card">
            {applications.map((application) => (
              <div className="metric" key={application.id}>
                <div>
                  <b>{application.project_title}</b>
                  <div className="mini">
                    {application.role} · {formatDate(application.created_at)}
                  </div>
                </div>
                <span
                  className={`tag${
                    application.status === 'accepted'
                      ? ' brand'
                      : application.status === 'pending'
                        ? ' warn'
                        : ''
                  }`}
                >
                  {application.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
