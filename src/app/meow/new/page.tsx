import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/backend/auth/current-user'
import { MeowForm } from '@/frontend/components/projects/MeowForm'

export const metadata = { title: '咩一个项目 · ISH' }

export default async function NewMeowPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <main className="standalone-shell">
      <div className="page-head">
        <div>
          <span className="eyebrow">MEOW / 咩</span>
          <h1>把一个想法说出来</h1>
          <p>
            先讲清楚你想做什么。提交后只对你和管理员可见，审核通过后才会公开。
          </p>
        </div>
        <Link className="text-link" href="/dashboard">
          返回工作台
        </Link>
      </div>

      <section className="panel project-form-panel">
        <MeowForm />
      </section>
    </main>
  )
}
