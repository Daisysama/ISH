'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { loginAction } from '@/backend/auth/actions'
import type { FormState } from '@/shared/auth'

export function LoginForm({ initialEmail }: { initialEmail?: string }) {
  const [state, action, isPending] = useActionState<FormState, FormData>(
    loginAction,
    {},
  )

  return (
    <>
      <div className="auth-form-heading">
        <span className="eyebrow">登录</span>
        <h2>回来看看。</h2>
        <p>羊群还在，路也还在。</p>
      </div>

      {state.error && (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      )}

      <form action={action}>
        <div className="field">
          <label htmlFor="email">邮箱</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={initialEmail}
            aria-invalid={state.field === 'email'}
            placeholder="you@example.com"
          />
        </div>

        <div className="field">
          <label htmlFor="password">密码</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            aria-invalid={state.field === 'password'}
            placeholder="输入密码"
          />
        </div>

        <button className="button button-primary button-full" type="submit" disabled={isPending}>
          {isPending ? '正在回来…' : '登录'}
        </button>
      </form>

      <p className="auth-switch">
        还没有账号？<Link href="/register">加入羊群</Link>
      </p>
    </>
  )
}
