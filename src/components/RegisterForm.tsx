'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { registerAction, type FormState } from '@/app/actions/auth'

export function RegisterForm() {
  const [state, action, isPending] = useActionState<FormState, FormData>(
    registerAction,
    {},
  )

  return (
    <>
      <h2>注册</h2>
      <p className="subtitle">注册完就能直接进来。</p>

      {state.error && (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      )}

      <form action={action}>
        <div className="field">
          <label htmlFor="displayName">显示名称</label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            maxLength={50}
            autoComplete="nickname"
            aria-invalid={state.field === 'displayName'}
          />
          <span className="hint">别人在 ISH 上看到你的名字，之后可以改。</span>
        </div>

        <div className="field">
          <label htmlFor="email">邮箱</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-invalid={state.field === 'email'}
          />
        </div>

        <div className="field">
          <label htmlFor="password">密码</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-invalid={state.field === 'password'}
          />
          <span className="hint">至少 8 位。</span>
        </div>

        <button className="btn" type="submit" disabled={isPending}>
          {isPending ? '注册中…' : '注册并进入'}
        </button>
      </form>

      <p className="auth-switch">
        已经有账号了？<Link href="/login">去登录</Link>
      </p>
    </>
  )
}
