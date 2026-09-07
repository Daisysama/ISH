export interface UserPublic {
  id: string
  handle: string
  display_name: string
  bio: string
  skills: string[]
  is_curator: boolean
  created_at: string
}

export interface Me extends UserPublic {
  email: string
}

export interface Member {
  user: UserPublic
  role: string
  is_owner: boolean
  joined_at: string
  agreement_signed: boolean
}

export interface ProjectSummary {
  id: string
  title: string
  summary: string
  category: string
  mode: string
  duration: string
  stage: string
  is_public: boolean
  created_at: string
  owner: UserPublic
  needs: string[]
  member_count: number
  milestones_done: number
  milestones_total: number
  agreement_version: number | null
  has_work: boolean
}

export interface ProjectDetail extends ProjectSummary {
  assets: string
  members: Member[]
  viewer_is_member: boolean
  viewer_is_owner: boolean
  viewer_agreement_signed: boolean
  viewer_has_pending_application: boolean
  pending_application_count: number
}

export interface Application {
  id: string
  project_id: string
  project_title: string
  applicant: UserPublic
  role: string
  why: string
  time_commitment: string
  proof: string
  status: string
  created_at: string
  decided_at: string | null
}

export interface Clause {
  key: string
  title: string
  body: string
}

export interface Agreement {
  id: string
  project_id: string
  version: number
  clauses: Clause[]
  change_note: string
  created_by: UserPublic
  created_at: string
  superseded_at: string | null
  accepted_by: { user: UserPublic; accepted_at: string }[]
  pending: UserPublic[]
  viewer_accepted: boolean
}

export interface Deliverable {
  id: string
  title: string
  kind: string
  url: string
  note: string
  created_by: UserPublic
  created_at: string
}

export interface Milestone {
  id: string
  project_id: string
  name: string
  description: string
  position: number
  status: string
  stage: string | null
  owner: UserPublic | null
  completed_at: string | null
  completed_by: UserPublic | null
  created_at: string
  deliverables: Deliverable[]
}

export interface ProjectEvent {
  id: string
  kind: string
  text: string
  tags: string[]
  actor: UserPublic | null
  created_at: string
}

export interface Health {
  days_since_last_event: number | null
  stalled: boolean
  hint: string
}

export interface Curation {
  fit: string
  avoid: string
  metrics: Record<string, number>
  editorial: string
  commercial_relation: string
  audience_tags: string[]
  curator: UserPublic
  updated_at: string
}

export interface Work {
  id: string
  project_id: string
  project_title: string
  title: string
  summary: string
  kind: string
  url: string
  published_at: string
  published_by: UserPublic
  credits: Member[]
  tags: { tag: string; source: string }[]
  curation: Curation | null
  match_score: number
  match_reasons: string[]
  disclosure: string
}

export interface PortfolioProject {
  project_id: string
  title: string
  category: string
  mode: string
  stage: string
  role: string
  is_owner: boolean
  joined_at: string
  milestones_completed_by_user: number
  milestones_total: number
  deliverables_by_user: number
  agreement_version_signed: number | null
  works: string[]
}

export interface Portfolio {
  user: UserPublic
  projects: PortfolioProject[]
  project_count: number
  work_count: number
  collaborators: UserPublic[]
  note: string
}

export interface AuditEvent {
  seq: number
  actor_handle: string | null
  action: string
  object_type: string
  object_id: string
  project_id: string | null
  summary: string
  payload: Record<string, unknown>
  created_at: string
  prev_hash: string
  hash: string
}

export interface ChainVerify {
  ok: boolean
  checked: number
  broken_at_seq: number | null
  reason: string
  head_hash: string | null
}

export interface Disclosure {
  work_id: string
  work_title: string
  commercial_relation: string
  label: string
  curator_handle: string
  updated_at: string
}

export interface Principle {
  key: string
  title: string
  body: string
  enforced_by: string
}
