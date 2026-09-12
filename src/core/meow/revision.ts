import {
  PROJECT_TYPE_OPTIONS,
  SEEKING_ROLE_OPTIONS,
} from '@/core/meow/project'
import {
  GROUP_ACCESS_LABELS,
  PROJECT_AUDIENCE_LABELS,
  PROJECT_PURPOSE_LABELS,
  PROJECT_STAGE_LABELS,
} from '@/shared/project'
import type { ProjectFormValues } from '@/shared/project'

type RevisionSnapshot = {
  title: string
  summary: string
  description: string | null
  stage: keyof typeof PROJECT_STAGE_LABELS
  purpose: keyof typeof PROJECT_PURPOSE_LABELS
  audience: keyof typeof PROJECT_AUDIENCE_LABELS
  typeTags: string[]
  seekingTags: string[]
  platforms: string[]
  externalUrl: string | null
  groupType: string | null
  groupContact: string | null
  groupAccessMode: keyof typeof GROUP_ACCESS_LABELS
  allowIshJoinGroup: boolean
}

const officialTypeTags = new Set<string>(PROJECT_TYPE_OPTIONS)
const officialSeekingTags = new Set<string>(SEEKING_ROLE_OPTIONS)

export function projectSnapshotToFormValues(snapshot: RevisionSnapshot): ProjectFormValues {
  return {
    title: snapshot.title,
    summary: snapshot.summary,
    description: snapshot.description ?? '',
    stage: snapshot.stage,
    purpose: snapshot.purpose,
    audience: snapshot.audience,
    typeTags: snapshot.typeTags.filter((tag) => officialTypeTags.has(tag)),
    customTypeTags: snapshot.typeTags.filter((tag) => !officialTypeTags.has(tag)),
    seekingTags: snapshot.seekingTags.filter((tag) => officialSeekingTags.has(tag)),
    customSeekingTags: snapshot.seekingTags.filter((tag) => !officialSeekingTags.has(tag)),
    platforms: snapshot.platforms,
    externalUrl: snapshot.externalUrl ?? '',
    groupType: snapshot.groupType ?? '',
    groupContact: snapshot.groupContact ?? '',
    groupAccessMode: snapshot.groupAccessMode,
    allowIshJoinGroup: snapshot.allowIshJoinGroup,
  }
}

function sameArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function text(value: string | null | undefined) {
  return value?.trim() || '未填写'
}

function tags(values: string[]) {
  return values.length ? values.join(' · ') : '未填写'
}

export type ProjectRevisionChange = {
  key: string
  label: string
  before: string
  after: string
}

export function getProjectRevisionChanges(
  current: RevisionSnapshot,
  next: RevisionSnapshot,
): ProjectRevisionChange[] {
  const changes: ProjectRevisionChange[] = []

  const add = (key: string, label: string, before: string, after: string) => {
    if (before !== after) changes.push({ key, label, before, after })
  }

  add('title', '项目名称', current.title, next.title)
  add('summary', '一句话介绍', current.summary, next.summary)
  add('description', '补充说明', text(current.description), text(next.description))
  add('stage', '成长阶段', PROJECT_STAGE_LABELS[current.stage], PROJECT_STAGE_LABELS[next.stage])
  add('purpose', '主要目的', PROJECT_PURPOSE_LABELS[current.purpose], PROJECT_PURPOSE_LABELS[next.purpose])
  add('audience', '主要受众', PROJECT_AUDIENCE_LABELS[current.audience], PROJECT_AUDIENCE_LABELS[next.audience])
  if (!sameArray(current.typeTags, next.typeTags)) add('typeTags', '类型与标签', tags(current.typeTags), tags(next.typeTags))
  if (!sameArray(current.seekingTags, next.seekingTags)) add('seekingTags', '寻找同行', tags(current.seekingTags), tags(next.seekingTags))
  if (!sameArray(current.platforms, next.platforms)) add('platforms', '目标平台', tags(current.platforms), tags(next.platforms))
  add('externalUrl', '作品链接', text(current.externalUrl), text(next.externalUrl))
  add('groupType', '群聊类型', text(current.groupType), text(next.groupType))
  add('groupAccessMode', '群聊开放', GROUP_ACCESS_LABELS[current.groupAccessMode], GROUP_ACCESS_LABELS[next.groupAccessMode])
  add('groupContact', '群聊信息', text(current.groupContact), text(next.groupContact))
  add('allowIshJoinGroup', '邀请 ISH 加群', current.allowIshJoinGroup ? '是' : '否', next.allowIshJoinGroup ? '是' : '否')

  return changes
}
