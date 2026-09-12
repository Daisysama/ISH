'use client'

import { useActionState, useEffect } from 'react'

import { createProjectAction, submitProjectRevisionAction } from '@/backend/projects/actions'
import {
  GROUP_TYPE_OPTIONS,
  PLATFORM_OPTIONS,
  PROJECT_LIMITS,
  PROJECT_TAG_GROUPS,
  SEEKING_ROLE_OPTIONS,
} from '@/core/meow/project'
import { CustomTagInput } from '@/frontend/components/tags/CustomTagInput'
import {
  GROUP_ACCESS_LABELS,
  PROJECT_AUDIENCE_LABELS,
  PROJECT_PURPOSE_LABELS,
  PROJECT_STAGE_LABELS,
} from '@/shared/project'
import type {
  GroupAccessModeValue,
  ProjectAudienceValue,
  ProjectFormField,
  ProjectFormState,
  ProjectFormValues,
  ProjectPurposeValue,
  ProjectStageValue,
} from '@/shared/project'

function CheckboxChip({ name, value, defaultChecked = false }: { name: string; value: string; defaultChecked?: boolean }) {
  return (
    <label className="choice-chip">
      <input defaultChecked={defaultChecked} name={name} type="checkbox" value={value} />
      <span>{value}</span>
    </label>
  )
}


function FieldError({ state, field }: { state: ProjectFormState; field: ProjectFormField }) {
  if (!state.error || state.field !== field) return null
  return <p className="field-error-message" role="alert">{state.error}</p>
}

type MeowFormProps = {
  mode?: 'create' | 'revision'
  projectId?: string
  revisionId?: string
  initialValues?: ProjectFormValues
}

export function MeowForm({
  mode = 'create',
  projectId,
  revisionId,
  initialValues,
}: MeowFormProps = {}) {
  const submitAction = mode === 'revision' ? submitProjectRevisionAction : createProjectAction
  const [state, action, isPending] = useActionState<ProjectFormState, FormData>(
    submitAction,
    {},
  )
  const values = state.values ?? initialValues

  useEffect(() => {
    if (!state.error || !state.field) return

    const target = document.querySelector<HTMLElement>(`[data-project-field="${state.field}"]`)
    if (!target) return

    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const focusable = target.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])',
      )
      focusable?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [state.attempt, state.error, state.field])

  return (
    <form key={state.attempt ?? `${mode}:${revisionId ?? projectId ?? 'new'}`} action={action} className="project-form structured-meow-form">
      {mode === 'revision' && projectId && <input type="hidden" name="projectId" value={projectId} />}
      {mode === 'revision' && revisionId && <input type="hidden" name="revisionId" value={revisionId} />}

      <section className="form-section">
        <div className="form-section-heading">
          <span>01</span>
          <div><h3>先让大家认出这声咩</h3><p>名字和一句话就够，不用先写企划书。</p></div>
        </div>

        <div className="field" data-project-field="title">
          <label htmlFor="title">项目名称 *</label>
          <input
            id="title"
            name="title"
            type="text"
            required
            minLength={2}
            maxLength={PROJECT_LIMITS.titleMax}
            aria-invalid={state.field === 'title'}
            placeholder="给您的想法起个名字"
            defaultValue={values?.title ?? ''}
          />
          <FieldError state={state} field="title" />
        </div>

        <div className="field" data-project-field="summary">
          <label htmlFor="summary">一句话说说它是什么 *</label>
          <textarea
            id="summary"
            name="summary"
            required
            minLength={10}
            maxLength={PROJECT_LIMITS.summaryMax}
            aria-invalid={state.field === 'summary'}
            placeholder="例如：一款关于孤独与回应的像素叙事游戏"
            rows={3}
            defaultValue={values?.summary ?? ''}
          />
          <span className="hint">10–{PROJECT_LIMITS.summaryMax} 个字。</span>
          <FieldError state={state} field="summary" />
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>02</span>
          <div><h3>咩咩啊？ *</h3><p>选几个标签，让羊群一眼知道您在做什么。</p></div>
        </div>

        <div className="official-tag-groups" aria-label="项目标签" data-project-field="typeTags">
          {PROJECT_TAG_GROUPS.map((group, index) => (
            <details className="official-tag-group" key={group.label} open={index < 2}>
              <summary>{group.label}<span>{group.options.length} 个官方标签</span></summary>
              <div className="choice-grid">
                {group.options.map((option) => <CheckboxChip key={option} name="typeTags" value={option} defaultChecked={values?.typeTags.includes(option) ?? false} />)}
              </div>
            </details>
          ))}
        </div>
        <FieldError state={state} field="typeTags" />

        <div className="field field-compact">
          <label htmlFor="customTypeTags">没有找到？自己咩一个标签</label>
          <CustomTagInput
            id="customTypeTags"
            name="customTypeTags"
            defaultTags={values?.customTypeTags ?? []}
            maxTags={PROJECT_LIMITS.customTagMaxCount}
            maxLength={PROJECT_LIMITS.tagMax}
            placeholder="例如：时间循环、互动电影、电波系"
            hint={`输入后按回车或逗号生成标签；最多 ${PROJECT_LIMITS.customTagMaxCount} 个。常见的自定义标签以后也可能加入官方标签库。`}
          />
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>03</span>
          <div><h3>现在走到哪里啦？ *</h3><p>这是项目成长阶段，不是平台审核状态。</p></div>
        </div>

        <div className="choice-grid choice-grid-stage" data-project-field="stage">
          {(Object.entries(PROJECT_STAGE_LABELS) as [ProjectStageValue, string][]).map(([value, label], index) => (
            <label className="choice-chip" key={value}>
              <input defaultChecked={(values?.stage ?? 'IDEA') === value} name="stage" type="radio" value={value} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <FieldError state={state} field="stage" />
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>04</span>
          <div><h3>这声咩想干嘛？ *</h3><p>只选一个主要目的，别让发布变成填问卷。</p></div>
        </div>
        <div className="choice-grid choice-grid-purpose" data-project-field="purpose">
          {(Object.entries(PROJECT_PURPOSE_LABELS) as [ProjectPurposeValue, string][]).map(([value, label], index) => (
            <label className="choice-chip" key={value}>
              <input defaultChecked={(values?.purpose ?? 'COLLABORATE') === value} name="purpose" type="radio" value={value} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <FieldError state={state} field="purpose" />
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>05</span>
          <div><h3>主要想让谁听见？ *</h3><p>这是推荐方向，不是把其他人锁在门外。</p></div>
        </div>
        <div className="choice-grid choice-grid-audience" data-project-field="audience">
          {(Object.entries(PROJECT_AUDIENCE_LABELS) as [ProjectAudienceValue, string][]).map(([value, label], index) => (
            <label className="choice-chip" key={value}>
              <input defaultChecked={(values?.audience ?? 'EVERYONE') === value} name="audience" type="radio" value={value} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <FieldError state={state} field="audience" />
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>06</span>
          <div><h3>想找什么样的羊？</h3><p>没有招募需求也可以留空。</p></div>
        </div>

        <div className="choice-grid" aria-label="寻找的同行者" data-project-field="seekingTags">
          {SEEKING_ROLE_OPTIONS.map((option) => <CheckboxChip key={option} name="seekingTags" value={option} defaultChecked={values?.seekingTags.includes(option) ?? false} />)}
        </div>
        <FieldError state={state} field="seekingTags" />

        <div className="field field-compact">
          <label htmlFor="customSeekingTags">其他技能</label>
          <CustomTagInput
            id="customSeekingTags"
            name="customSeekingTags"
            defaultTags={values?.customSeekingTags ?? []}
            maxTags={PROJECT_LIMITS.customTagMaxCount}
            maxLength={PROJECT_LIMITS.tagMax}
            placeholder="例如：Ren'Py、UE5 蓝图、Live2D"
            hint={`可以写更具体的技术；最多 ${PROJECT_LIMITS.customTagMaxCount} 个。`}
          />
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>07</span>
          <div><h3>已经做出点东西了？</h3><p>有平台、有 Demo、有页面，就让大家能直接找到它。</p></div>
        </div>

        <div className="choice-grid" aria-label="目标平台" data-project-field="platforms">
          {PLATFORM_OPTIONS.map((option) => <CheckboxChip key={option} name="platforms" value={option} defaultChecked={values?.platforms.includes(option) ?? false} />)}
        </div>
        <FieldError state={state} field="platforms" />

        <div className="field field-compact" data-project-field="externalUrl">
          <label htmlFor="externalUrl">作品 / Demo / 项目链接</label>
          <input id="externalUrl" name="externalUrl" type="url" placeholder="https://..." aria-invalid={state.field === 'externalUrl'} defaultValue={values?.externalUrl ?? ''} />
          <FieldError state={state} field="externalUrl" />
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>08</span>
          <div><h3>已经有地方聊天了吗？</h3><p>您自己决定群聊是公开、申请制还是先保密。</p></div>
        </div>

        <div className="field-row">
          <div className="field" data-project-field="groupType">
            <label htmlFor="groupType">群聊类型</label>
            <select id="groupType" name="groupType" defaultValue={values?.groupType ?? ''}>
              <option value="">还没有 / 暂不填写</option>
              {GROUP_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <FieldError state={state} field="groupType" />
          </div>
          <div className="field" data-project-field="groupContact">
            <label htmlFor="groupContact">群号 / 邀请链接 / 加群说明</label>
            <input id="groupContact" name="groupContact" type="text" maxLength={PROJECT_LIMITS.groupContactMax} placeholder="选填" defaultValue={values?.groupContact ?? ''} />
            <FieldError state={state} field="groupContact" />
          </div>
        </div>

        <div className="field" data-project-field="groupAccessMode">
          <label>群聊怎么开放？</label>
          <div className="choice-grid choice-grid-group-access">
            {(Object.entries(GROUP_ACCESS_LABELS) as [GroupAccessModeValue, string][]).map(([value, label]) => (
              <label className="choice-chip" key={value}>
                <input
                  defaultChecked={(values?.groupAccessMode ?? 'PRIVATE') === value}
                  name="groupAccessMode"
                  type="radio"
                  value={value}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <span className="hint">公开适合试玩、宣传和玩家群；申请制只对被您接受的同行者解锁；保密则暂不对外展示。</span>
          <FieldError state={state} field="groupAccessMode" />
        </div>

        <label className="ish-companion-option">
          <input name="allowIshJoinGroup" type="checkbox" defaultChecked={values?.allowIshJoinGroup ?? false} />
          <span>
            <strong>欢迎 ISH 加入群聊</strong>
            <small>如果您愿意，ISH 也许会加入群聊，了解项目正在发生什么，在需要的时候提供帮助，并陪伴项目成长。</small>
          </span>
        </label>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>09</span>
          <div><h3>还有什么想告诉羊群的吗？</h3><p>选填。世界观、玩法、开发计划，想说多少都可以。</p></div>
        </div>

        <div className="field" data-project-field="description">
          <textarea
            id="description"
            name="description"
            maxLength={PROJECT_LIMITS.descriptionMax}
            aria-invalid={state.field === 'description'}
            placeholder="不写也没关系。"
            rows={7}
            defaultValue={values?.description ?? ''}
          />
          <span className="hint">最多 {PROJECT_LIMITS.descriptionMax} 个字。</span>
          <FieldError state={state} field="description" />
        </div>
      </section>

      {state.error && !state.field && <div className="form-error" role="alert">{state.error}</div>}

      <div className="meow-submit-zone">
        <div>
          <strong>{mode === 'revision' ? '线上版本会继续晒太阳。' : 'ISH 不只帮您发声，也愿意陪您一起走。'}</strong>
          <p>{mode === 'revision' ? '这份修改会单独进入审核；通过以前，大家看到的仍然是当前公开版本。' : '提交后会先由 ISH 看一眼。通过审核后，项目就会去羊群广场晒太阳。'}</p>
          <small>We + ISH = WISH.</small>
        </div>
        <button className="button button-primary" type="submit" disabled={isPending}>
          {isPending
            ? (mode === 'revision' ? '正在提交修改…' : '正在发出这一声…')
            : (mode === 'revision' ? (revisionId ? '重新提交修改 →' : '提交修改再审 →') : '发出这声咩 →')}
        </button>
      </div>
    </form>
  )
}
