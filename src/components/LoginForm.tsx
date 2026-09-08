'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { loginAction, type FormState } from '@/app/actions/auth'

/**
 * 'use client' 表示这个组件在浏览器里运行 —— 因为它需要响应用户输入。
 *
 * useActionState 把表单和服务器函数接起来：
 *   state     服务器返回的结果（这里就是错误信息）
 *   action    绑到 <form> 上，提交时自动调用服务器函数
 *   isPending 提交进行中，用来把按钮变成禁用状态防止重复点击
 */
export function LoginForm({ initialEmail }: { initialEmail?: string }) {
  const [state, action, isPending] = useActionState<FormState, FormData>(
    loginAction,
    {},
  )

  return (
    <>
      <h2>登录</h2>
      <p className="subtitle">欢迎回来。</p>

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
          />
        </div>

        <button className="btn" type="submit" disabled={isPending}>
          {isPending ? '登录中…' : '登录'}
        </button>
      </form>

      <p className="auth-switch">
        还没有账号？<Link href="/register">注册一个</Link>
      </p>
    </>
  )
}
