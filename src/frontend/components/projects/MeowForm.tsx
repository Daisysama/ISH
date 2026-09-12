'use client'

import { useActionState } from 'react'

import { createProjectAction } from '@/backend/projects/actions'
import {
  GROUP_TYPE_OPTIONS,
  PLATFORM_OPTIONS,
  PROJECT_LIMITS,
  PROJECT_TYPE_OPTIONS,
  SEEKING_ROLE_OPTIONS,
} from '@/core/meow/project'
import { PROJECT_STAGE_LABELS } from '@/shared/project'
import type { ProjectFormState, ProjectStageValue } from '@/shared/project'

function CheckboxChip({ name, value }: { name: string; value: string }) {
  return (
    <label className="choice-chip">
      <input name={name} type="checkbox" value={value} />
      <span>{value}</span>
    </label>
  )
}

export function MeowForm() {
  const [state, action, isPending] = useActionState<ProjectFormState, FormData>(
    createProjectAction,
    {},
  )

  return (
    <form action={action} className="project-form structured-meow-form">
      {state.error && <div className="form-error" role="alert">{state.error}</div>}

      <section className="form-section">
        <div className="form-section-heading">
          <span>01</span>
          <div><h3>先让大家认出这声咩</h3><p>名字和一句话就够，不用先写企划书。</p></div>
        </div>

        <div className="field">
          <label htmlFor="title">项目名称 *</label>
          <input
            id="title"
            name="title"
            type="text"
            required
            minLength={2}
            maxLength={PROJECT_LIMITS.titleMax}
            aria-invalid={state.field === 'title'}
            placeholder="给你的想法起个名字"
          />
        </div>

        <div className="field">
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
          />
          <span className="hint">10–{PROJECT_LIMITS.summaryMax} 个字。</span>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>02</span>
          <div><h3>咩咩啊？ *</h3><p>选几个标签，让羊群一眼知道你在做什么。</p></div>
        </div>

        <div className="choice-grid" aria-label="项目类型">
          {PROJECT_TYPE_OPTIONS.map((option) => <CheckboxChip key={option} name="typeTags" value={option} />)}
        </div>

        <div className="field field-compact">
          <label htmlFor="customTypeTags">其他标签</label>
          <input id="customTypeTags" name="customTypeTags" type="text" placeholder="例如：时间循环、互动电影、电波系" />
          <span className="hint">可自定义，使用逗号分隔；最多 3 个。</span>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>03</span>
          <div><h3>现在走到哪里啦？ *</h3><p>这是项目成长阶段，不是平台审核状态。</p></div>
        </div>

        <div className="choice-grid choice-grid-stage">
          {(Object.entries(PROJECT_STAGE_LABELS) as [ProjectStageValue, string][]).map(([value, label], index) => (
            <label className="choice-chip" key={value}>
              <input defaultChecked={index === 0} name="stage" type="radio" value={value} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>04</span>
          <div><h3>想找什么样的羊？</h3><p>没有招募需求也可以留空。</p></div>
        </div>

        <div className="choice-grid" aria-label="寻找的同行者">
          {SEEKING_ROLE_OPTIONS.map((option) => <CheckboxChip key={option} name="seekingTags" value={option} />)}
        </div>

        <div className="field field-compact">
          <label htmlFor="customSeekingTags">其他技能</label>
          <input id="customSeekingTags" name="customSeekingTags" type="text" placeholder="例如：Ren'Py、UE5 蓝图、Live2D" />
          <span className="hint">可以写更具体的技术；最多 3 个。</span>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>05</span>
          <div><h3>已经做出点东西了？</h3><p>有平台、有 Demo、有页面，就让大家能直接找到它。</p></div>
        </div>

        <div className="choice-grid" aria-label="目标平台">
          {PLATFORM_OPTIONS.map((option) => <CheckboxChip key={option} name="platforms" value={option} />)}
        </div>

        <div className="field field-compact">
          <label htmlFor="externalUrl">作品 / Demo / 项目链接</label>
          <input id="externalUrl" name="externalUrl" type="url" placeholder="https://..." aria-invalid={state.field === 'externalUrl'} />
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>06</span>
          <div><h3>已经有地方聊天了吗？</h3><p>群聊信息默认不会公开给所有访客。</p></div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="groupType">群聊类型</label>
            <select id="groupType" name="groupType" defaultValue="">
              <option value="">还没有 / 暂不填写</option>
              {GROUP_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="groupContact">群号 / 邀请链接 / 加群说明</label>
            <input id="groupContact" name="groupContact" type="text" maxLength={PROJECT_LIMITS.groupContactMax} placeholder="选填" />
          </div>
        </div>

        <label className="ish-companion-option">
          <input name="allowIshJoinGroup" type="checkbox" />
          <span>
            <strong>欢迎 ISH 加入群聊</strong>
            <small>如果你愿意，ISH 也许会加入群聊，了解项目正在发生什么，在需要的时候提供帮助，并陪伴项目成长。</small>
          </span>
        </label>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>07</span>
          <div><h3>还有什么想告诉羊群的吗？</h3><p>选填。世界观、玩法、开发计划，想说多少都可以。</p></div>
        </div>

        <div className="field">
          <textarea
            id="description"
            name="description"
            maxLength={PROJECT_LIMITS.descriptionMax}
            aria-invalid={state.field === 'description'}
            placeholder="不写也没关系。"
            rows={7}
          />
          <span className="hint">最多 {PROJECT_LIMITS.descriptionMax} 个字。</span>
        </div>
      </section>

      <div className="meow-submit-zone">
        <div>
          <strong>ISH 不只帮你发声，也愿意陪你往前走。</strong>
          <p>提交后会先由 ISH 看一眼。通过审核后，项目就会去羊群广场晒太阳。</p>
          <small>We + ISH = WISH.</small>
        </div>
        <button className="button button-primary" type="submit" disabled={isPending}>
          {isPending ? '正在发出这一声…' : '发出这声咩 →'}
        </button>
      </div>
    </form>
  )
}
