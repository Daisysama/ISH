import Link from 'next/link'

import { PROJECT_STAGE_LABELS } from '@/shared/project'
import type { ProjectStageValue } from '@/shared/project'

type PublicProjectCard = {
  id: string
  title: string
  summary: string
  stage: ProjectStageValue
  typeTags: string[]
  seekingTags: string[]
  platforms: string[]
  publishedAt: Date | null
  creator: { displayName: string }
}

function TagList({ tags, tone = 'default' }: { tags: string[]; tone?: 'default' | 'green' }) {
  if (tags.length === 0) return null
  const visible = tags.slice(0, 3)
  const rest = tags.length - visible.length

  return (
    <div className="tag-row tag-row-compact">
      {visible.map((tag) => <span className={`tag-chip ${tone === 'green' ? 'tag-chip-green' : ''}`} key={tag}>{tag}</span>)}
      {rest > 0 && <span className="tag-chip">+{rest}</span>}
    </div>
  )
}

export function ProjectCard({ project, index = 0 }: { project: PublicProjectCard; index?: number }) {
  const tone = index % 3

  return (
    <article className="flock-card">
      <Link className={`flock-card-art flock-card-art-${tone}`} href={`/projects/${project.id}`}>
        <span className="flock-card-sun" />
        <span className="flock-card-path" />
        <span className="flock-card-art-copy">{PROJECT_STAGE_LABELS[project.stage]}</span>
      </Link>
      <div className="flock-card-body">
        <div className="flock-card-meta">
          <span>{project.creator.displayName}</span>
          {project.publishedAt && <time dateTime={project.publishedAt.toISOString()}>{project.publishedAt.toLocaleDateString('zh-CN')}</time>}
        </div>
        <h2><Link href={`/projects/${project.id}`}>{project.title}</Link></h2>
        <p>{project.summary}</p>

        <TagList tags={project.typeTags} />
        {project.seekingTags.length > 0 && (
          <div className="card-seeking-row"><span>正在找</span><TagList tags={project.seekingTags} tone="green" /></div>
        )}

        <Link className="story-link" href={`/projects/${project.id}`}>
          走近看看 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  )
}
