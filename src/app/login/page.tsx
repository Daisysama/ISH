import { BrandHeader } from '@/frontend/components/brand/BrandHeader'
import { LoginForm } from '@/frontend/components/auth/LoginForm'

export const metadata = { title: '登录 · ISH' }

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <BrandHeader />
        <LoginForm />
      </div>
    </main>
  )
}
