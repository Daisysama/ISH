import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/backend/auth/current-user'
import { db } from '@/backend/database/client'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { UserBlockForm } from '@/frontend/components/blocks/UserBlockForm'

export const metadata = { title: '我的拉黑名单 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function MyBlocksPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const blocks = await db.userBlock.findMany({ where: { blockerId: user.id, active: true }, orderBy: { createdAt: 'desc' },
    include: { blocked: { select: { displayName: true } } } })
  return <><GlobalHeader /><main className="moderation-shell shell-with-header">
    <Link className="page-breadcrumb" href="/profile">← 我的画像</Link>
    <h1>我的拉黑名单</h1><p>只调整您看到的动态与日后互动，不是平台处分；不会阻断双方通过网站举报、申诉或查看已有权益记录。</p>
    {blocks.length === 0 && <section className="empty-state compact-empty"><h2>目前没有拉黑任何人。</h2></section>}
    {blocks.map(item => <section className="panel governance-block-row" key={item.id}>
      <strong>{item.blocked.displayName}</strong><UserBlockForm targetUserId={item.blockedId} active />
    </section>)}
  </main></>
}
