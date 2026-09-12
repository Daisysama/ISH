import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'
import { MeowForm } from '@/frontend/components/projects/MeowForm'

export const metadata = { title: '咩一个 · FromISH' }

export default async function NewMeowPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <>
      <GlobalHeader active="meow" />
      <main className="creative-shell shell-with-header">
        <Link className="page-breadcrumb" href="/dashboard">← 我的项目</Link>

        <div className="creative-layout">
          <aside className="meow-intro">
            <span className="eyebrow">MEOW / 咩</span>
            <h1>把脑海里的那一声咩，放出来。</h1>
            <p>不需要先写一份企划书。告诉大家：你想做什么、走到哪里了、还缺什么样的羊。</p>

            <div className="meow-steps">
              <div><span>01</span><strong>咩清楚</strong><p>选标签，写一句话，让羊群一眼看懂。</p></div>
              <div><span>02</span><strong>等审核</strong><p>提交后先保持非公开，ISH 人工看一眼。</p></div>
              <div><span>03</span><strong>晒太阳</strong><p>审核通过后，项目就会来到羊群广场。</p></div>
            </div>
          </aside>

          <section className="panel project-form-panel">
            <div className="form-panel-heading">
              <span className="eyebrow">第一声咩</span>
              <h2>几分钟，把想法说清楚。</h2>
              <p>ISH 不只帮你发声，也愿意陪你往前走。</p>
            </div>
            <MeowForm />
          </section>
        </div>
      </main>
    </>
  )
}
