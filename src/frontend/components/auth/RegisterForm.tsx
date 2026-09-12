'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { registerAction } from '@/backend/auth/actions'
import type { FormState } from '@/shared/auth'

export function RegisterForm({ nextPath }: { nextPath?: string }) {
  const [state, action, isPending] = useActionState<FormState, FormData>(
    registerAction,
    {},
  )

  return (
    <>
      <div className="auth-form-heading">
        <span className="eyebrow">加入羊群</span>
        <h2>先认识一下。</h2>
        <p>不用把自己写成简历，给同行者一个好记的名字就行。</p>
      </div>

      {state.error && (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      )}

      <form action={action}>
        {nextPath && <input type="hidden" name="next" value={nextPath} />}
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
            placeholder="别人怎么称呼您？"
          />
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
            minLength={8}
            autoComplete="new-password"
            aria-invalid={state.field === 'password'}
            placeholder="至少 8 位"
          />
          <span className="hint">至少 8 位；后续会继续完善账号安全能力。</span>
        </div>

        <button className="button button-primary button-full" type="submit" disabled={isPending}>
          {isPending ? '正在加入…' : '加入羊群'}
        </button>
      </form>

      <p className="auth-switch">
        已经是羊群的一员？<Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'}>去登录</Link>
      </p>
    </>
  )
}
