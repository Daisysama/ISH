import Link from 'next/link'

import { LoginForm } from '@/frontend/components/auth/LoginForm'
import { BrandHeader } from '@/frontend/components/brand/BrandHeader'

export const metadata = { title: '登录 · FromISH', robots: { index: false, follow: false } }

type LoginPageProps = { searchParams: Promise<{ next?: string | string[] }> }

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const next = Array.isArray(params.next) ? params.next[0] : params.next
  return (
    <main className="auth-stage">
      <section className="auth-scene">
        <Link className="auth-back-link" href="/projects">← 先去羊群逛逛</Link>
        <div className="auth-scene-copy">
          <span className="eyebrow">WELCOME BACK</span>
          <h1>有点子？上伊始！<br />找乐子？也上伊始！</h1>
          <p>回来看看，那些还没长大的作品今天又走到了哪里。</p>
        </div>
        <div className="auth-landscape" aria-hidden="true">
          <span className="auth-landscape-sun" />
          <span className="auth-landscape-hill auth-landscape-hill-1" />
          <span className="auth-landscape-hill auth-landscape-hill-2" />
          <span className="auth-landscape-glow" />
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <BrandHeader />
          <LoginForm nextPath={next} />
        </div>
      </section>
    </main>
  )
}
