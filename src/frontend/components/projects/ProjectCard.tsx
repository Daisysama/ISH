import Link from 'next/link'

import { ProjectPreferenceControls } from '@/frontend/components/projects/ProjectPreferenceControls'

import {
  PROJECT_AUDIENCE_LABELS,
  PROJECT_PURPOSE_LABELS,
  PROJECT_STAGE_LABELS,
} from '@/shared/project'
import { projectHref } from '@/shared/navigation'
import { publicUserHref } from '@/shared/user-navigation'
import type { ProjectReturnSource } from '@/shared/navigation'
import type {
  ProjectAudienceValue,
  ProjectPurposeValue,
  ProjectStageValue,
} from '@/shared/project'


type PreferenceContext = {
  likedTags: string[]
  dislikedTags: string[]
  suppressInterestedPrompt: boolean
  suppressNotInterestedPrompt: boolean
  initialKind: 'INTERESTED' | 'NOT_INTERESTED' | null
  initialHidden: boolean
  initialFavorited: boolean
}

type PublicProjectCard = {
  id: string
  title: string
  summary: string
  stage: ProjectStageValue
  purpose: ProjectPurposeValue
  audience: ProjectAudienceValue
  typeTags: string[]
  seekingTags: string[]
  platforms: string[]
  publishedAt: Date | null
  creator: { id: string; uid: number; displayName: string }
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

export function ProjectCard({ project, index = 0, preferenceContext = null, returnSource = 'projects' }: { project: PublicProjectCard; index?: number; preferenceContext?: PreferenceContext | null; returnSource?: ProjectReturnSource }) {
  const tone = index % 3

  return (
    <article className="flock-card">
      <Link className={`flock-card-art flock-card-art-${tone}`} href={projectHref(project.id, returnSource)}>
        <span className="flock-card-sun" />
        <span className="flock-card-path" />
        <span className="flock-card-art-copy">{PROJECT_STAGE_LABELS[project.stage]}</span>
      </Link>
      <div className="flock-card-body">
        <div className="flock-card-meta">
          <Link className="user-name-link" href={publicUserHref(project.creator.uid, returnSource === 'home' ? '/' : '/projects')}>{project.creator.displayName}</Link>
          {project.publishedAt && <time dateTime={project.publishedAt.toISOString()}>{project.publishedAt.toLocaleDateString('zh-CN')}</time>}
        </div>
        <div className="project-axis-row">
          <span className="axis-pill axis-pill-purpose">{PROJECT_PURPOSE_LABELS[project.purpose]}</span>
          <span className="axis-pill">{PROJECT_AUDIENCE_LABELS[project.audience]}</span>
        </div>
        <h2><Link href={projectHref(project.id, returnSource)}>{project.title}</Link></h2>
        <p>{project.summary}</p>

        <TagList tags={project.typeTags} />
        {project.seekingTags.length > 0 && (
          <div className="card-seeking-row"><span>正在找</span><TagList tags={project.seekingTags} tone="green" /></div>
        )}

        {preferenceContext && <ProjectPreferenceControls projectId={project.id} projectTags={project.typeTags} likedTags={preferenceContext.likedTags} dislikedTags={preferenceContext.dislikedTags} suppressInterestedPrompt={preferenceContext.suppressInterestedPrompt} suppressNotInterestedPrompt={preferenceContext.suppressNotInterestedPrompt} initialKind={preferenceContext.initialKind} initialHidden={preferenceContext.initialHidden} initialFavorited={preferenceContext.initialFavorited} />}

        <Link className="story-link" href={projectHref(project.id, returnSource)}>
          走近看看 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  )
}
