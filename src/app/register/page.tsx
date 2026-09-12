import Link from 'next/link'

import { RegisterForm } from '@/frontend/components/auth/RegisterForm'
import { BrandHeader } from '@/frontend/components/brand/BrandHeader'

export const metadata = { title: '加入羊群 · FromISH', robots: { index: false, follow: false } }

type RegisterPageProps = { searchParams: Promise<{ next?: string | string[] }> }

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams
  const next = Array.isArray(params.next) ? params.next[0] : params.next
  return (
    <main className="auth-stage">
      <section className="auth-scene auth-scene-register">
        <Link className="auth-back-link" href="/projects">← 先去羊群逛逛</Link>
        <div className="auth-scene-copy">
          <span className="eyebrow">COME AS YOU ARE</span>
          <h1>加入羊群，<br />一起追逐太阳！</h1>
          <p>可以是创作者，也可以只是一个想早点遇见好作品的玩家。</p>
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
          <RegisterForm nextPath={next} />
        </div>
      </section>
    </main>
  )
}
