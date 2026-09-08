import { BrandHeader } from '@/components/BrandHeader'
import { RegisterForm } from '@/components/RegisterForm'

export const metadata = { title: '注册 · ISH' }

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <BrandHeader />
        <RegisterForm />
      </div>
    </main>
  )
}
