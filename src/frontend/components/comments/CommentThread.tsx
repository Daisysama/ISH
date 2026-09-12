'use client'

import { useActionState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { getDiscussion } from '@/backend/comments/queries'
import { postCommentAction, setCommentPreferenceAction, toggleCommentDeletionAction, type CommentActionState } from '@/backend/comments/actions'
import { reportCommentAction, withdrawCommentReportAction, type CommentGovernanceState } from '@/backend/comments/governance'
import { appealHiddenCommentAction } from '@/backend/comments/appeals'
import { publicUserHref } from '@/shared/user-navigation'

type Discussion = NonNullable<Awaited<ReturnType<typeof getDiscussion>>>
type Comment = Discussion['roots'][number]

export function CommentComposer({ projectId, updateId, parentId }: { projectId: string; updateId: string | null; parentId?: string }) {
  const [state, action, pending] = useActionState<CommentActionState, FormData>(postCommentAction, {})
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => { if (state.success) form.current?.reset() }, [state.success])
  return <form ref={form} action={action} className="governance-mini-form comment-composer">
    <input type="hidden" name="projectId" value={projectId} />
    {updateId && <input type="hidden" name="updateId" value={updateId} />}
    {parentId && <input type="hidden" name="parentId" value={parentId} />}
    <label>{parentId ? '写一条回复' : '参与讨论'}<textarea name="body" minLength={2} maxLength={1200} rows={parentId ? 2 : 4}
      placeholder="说说您的想法，保持友善；请勿公开私人联系信息。" required /></label>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
    <button className="button button-primary button-compact" disabled={pending}>{pending ? '发送中…' : parentId ? '发布回复' : '发布评论'}</button>
  </form>
}

function CommentItem({ item, projectId, updateId, viewerId, allowReply, page, fromNotifications }: {
  item: Comment; projectId: string; updateId: string | null; viewerId?: string; allowReply: boolean; page: number; fromNotifications: boolean
}) {
  const mine = viewerId === item.authorId
  const [preference, changePreference, changingPreference] = useActionState<CommentActionState, FormData>(setCommentPreferenceAction, {})
  const [deletion, changeDeletion, deleting] = useActionState<CommentActionState, FormData>(toggleCommentDeletionAction, {})
  const [report, submitReport, reporting] = useActionState<CommentGovernanceState, FormData>(reportCommentAction, {})
  const [withdraw, withdrawReport, withdrawing] = useActionState<CommentGovernanceState, FormData>(withdrawCommentReportAction, {})
  const [appeal, submitAppeal, appealing] = useActionState<CommentGovernanceState, FormData>(appealHiddenCommentAction, {})
  const available = item.status === 'VISIBLE'
  const isFolded = available && item.blocked
  const params = new URLSearchParams()
  if (updateId) params.set('update', updateId)
  if (page > 1) params.set('page', String(page))
  if (fromNotifications) params.set('from', 'notifications')
  const returnTo = `/projects/${projectId}/discussion${params.size ? `?${params}` : ''}#comment-${item.id}`
  return <article className={`comment-card ${item.parentId ? 'comment-reply' : ''}`} id={`comment-${item.id}`}>
    <div className="comment-meta"><strong><Link className="user-name-link" href={publicUserHref(item.authorId, returnTo)}>{item.authorName}</Link>{item.isProducer && <span className="producer-badge">制作人</span>}</strong>
      <time dateTime={item.createdAt.toISOString()}>{item.createdAt.toLocaleString('zh-CN')}</time></div>
    {isFolded ? <details><summary>这条评论已在您的视图中屏蔽 · 展开查看</summary>
      {item.blockedAuthor && <p>您拉黑了这位用户，可以到 <Link className="story-link" href="/profile/blocks">我的拉黑名单</Link> 解除。</p>}
      <p className="comment-body">{item.body}</p></details>
      : available ? <p className="comment-body">{item.body}</p>
        : mine ? <p className="comment-body">{item.status === 'PENDING' ? '等待网站审核，仅您可见：' : item.status === 'DELETED' ? '已由您删除：' : '已被网站下架，仅您可见：'}{item.body}</p>
          : <p className="comment-tombstone">{item.status === 'DELETED' ? '作者已删除这条内容，历史回复仍保留。' : '这条内容暂不公开，历史回复仍保留。'}</p>}
    {mine && item.status === 'HIDDEN' && <p className="notice notice-danger">网站处理依据：{item.hiddenReason ?? '请核对站内消息。'}</p>}
    {available && viewerId && !mine && <div className="comment-actions">
      {(['LIKE', 'DISLIKE'] as const).map(kind => <form action={changePreference} key={kind}>
        <input type="hidden" name="commentId" value={item.id} /><input type="hidden" name="operation" value={kind} />
        <button className="button button-quiet button-compact" disabled={changingPreference} aria-pressed={item.reaction === kind}>
          {kind === 'LIKE' ? '赞' : '点踩'} {kind === 'LIKE' ? item.likes : item.dislikes}{item.reaction === kind ? ' · 撤销' : ''}
        </button>
      </form>)}
      <form action={changePreference}><input type="hidden" name="commentId" value={item.id} />
        <input type="hidden" name="operation" value={item.hiddenByMe ? 'SHOW' : 'HIDE'} />
        <button className="button button-quiet button-compact" disabled={changingPreference}>{item.hiddenByMe ? '取消私人屏蔽' : '仅对我屏蔽'}</button></form>
      {item.myReport?.retractedAt ? <span>已撤回原举报；历史裁决保留</span> :
        item.myReport && item.myReport.status !== 'WITHDRAWN' ? <form action={withdrawReport}>
        <input type="hidden" name="reportId" value={item.myReport.id} /><button className="button button-quiet button-compact" disabled={withdrawing}>撤回举报</button>
      </form> : <details className="comment-inline-details"><summary>举报</summary><form action={submitReport} className="governance-mini-form">
        <input type="hidden" name="commentId" value={item.id} />
        <label>问题类型<select name="category" required defaultValue=""><option value="" disabled>请选择</option>
          <option value="HARASSMENT">辱骂或骚扰</option><option value="MISLEADING">虚假误导</option>
          <option value="RIGHTS">作品及权益问题</option><option value="CONTENT">违规内容</option><option value="OTHER">其他</option>
        </select></label>
        <label>说明事实 *<textarea name="statement" minLength={10} maxLength={2000} required rows={3} /></label>
        <button className="button button-quiet button-compact" disabled={reporting}>向网站举报</button>
      </form></details>}
    </div>}
    {available && viewerId && allowReply && <details className="comment-inline-details"><summary>回复</summary>
      <CommentComposer projectId={projectId} updateId={updateId} parentId={item.id} /></details>}
    {mine && (available || item.status === 'PENDING' || item.status === 'DELETED') && <form action={changeDeletion} className="inline-action-form">
      <input type="hidden" name="commentId" value={item.id} />
      <button className="button button-quiet button-compact" disabled={deleting}>{item.status === 'DELETED' ? '撤销删除' : item.parentId ? '删除回复' : '删除评论'}</button>
    </form>}
    {mine && item.status === 'HIDDEN' && (item.myAppeal ?
      <p>独立申诉：{item.myAppeal.status === 'PENDING' ? '等待审核' : item.myAppeal.decision === 'REOPENED' ? '已恢复' : '维持下架'}
        {item.myAppeal.decisionReason && ` · ${item.myAppeal.decisionReason}`}</p>
      : <details className="comment-inline-details"><summary>向网站独立申诉</summary><form action={submitAppeal} className="governance-mini-form">
        <input type="hidden" name="commentId" value={item.id} /><label>申诉说明 *
          <textarea name="statement" minLength={10} maxLength={2000} rows={3} required /></label>
        <button className="button button-quiet button-compact" disabled={appealing}>提交申诉</button>
      </form></details>)}
    {[preference, deletion, report, withdraw, appeal].map((state, i) => state.error ? <p className="inline-error" role="alert" key={i}>{state.error}</p>
      : state.success ? <p className="inline-success" role="status" key={i}>{state.success}</p> : null)}
  </article>
}

export function CommentThread({ discussion, projectId, updateId, viewerId, canComment, fromNotifications }: {
  discussion: Discussion; projectId: string; updateId: string | null; viewerId?: string; canComment: boolean; fromNotifications: boolean
}) {
  const replies = new Map<string, Comment[]>()
  for (const reply of discussion.replies) if (reply.parentId) replies.set(reply.parentId, [...replies.get(reply.parentId) ?? [], reply])
  return <section className="comment-thread" aria-label="公开讨论">
    <h2>公开讨论 · {discussion.total}</h2><p>项目与每条动态分别讨论。点踩和屏蔽只改变您自己的视图；举报由网站独立审查。</p>
    {canComment ? <CommentComposer projectId={projectId} updateId={updateId} /> : viewerId ?
      <p>您的账号目前不能发表评论或回复。您仍可阅读讨论、查看 <Link href="/account/limited" className="story-link">处分依据与申诉</Link>。</p> :
      <p>登录后可以评论、回复、点赞和举报。</p>}
    {discussion.roots.length === 0 && <p className="comment-empty">还没有评论，欢迎写下第一条。</p>}
    {discussion.roots.map(item => <div className="comment-thread-group" key={item.id}>
      <CommentItem item={item} projectId={projectId} updateId={updateId} viewerId={viewerId} allowReply={canComment} page={discussion.page} fromNotifications={fromNotifications} />
      {replies.get(item.id)?.map(reply => <CommentItem key={reply.id} item={reply} projectId={projectId} updateId={updateId} viewerId={viewerId} allowReply={false} page={discussion.page} fromNotifications={fromNotifications} />)}
    </div>)}
  </section>
}

export function WithdrawCommentReportForm({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState<CommentGovernanceState, FormData>(withdrawCommentReportAction, {})
  return <form action={action} className="inline-action-form"><input type="hidden" name="reportId" value={reportId} />
    <button className="button button-quiet button-compact" disabled={pending}>撤回举报</button>
    {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    {state.success && <p className="inline-success" role="status">{state.success}</p>}
  </form>
}
