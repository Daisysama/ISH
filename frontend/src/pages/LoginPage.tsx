import { useState } from 'react'

import { ApiError } from '../api/client'
import { ErrorBox } from '../components/common'
import { useApp } from '../state/AppContext'

const DEMO_ACCOUNTS = [
  { email: 'alice@ish.demo', label: '林知夏 · 项目发起人' },
  { email: 'bob@ish.demo', label: '周野 · 协作者' },
  { email: 'curator@ish.demo', label: 'ISH 编辑部 · 策展' },
]
const DEMO_PASSWORD = 'ish-demo-2026'

export default function LoginPage() {
  const { login, register, notify } = useApp()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register({ email, handle, display_name: displayName, password })
      }
      notify('欢迎回到 ISH')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '请求失败')
    } finally {
      setBusy(false)
    }
  }

  async function quickLogin(demoEmail: string) {
    setError(null)
    setBusy(true)
    try {
      await login(demoEmail, DEMO_PASSWORD)
      notify('已登录演示账号')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '请求失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-card card">
        <div className="brand" style={{ padding: '0 0 18px' }}>
          <div className="brandmark">ISH</div>
          <div>
            <h1>伊始</h1>
            <small>Idea → People → Trust → Execution → Work → Audience</small>
          </div>
        </div>

        <div className="tabs">
          <button
            className={`tab${mode === 'login' ? ' active' : ''}`}
            onClick={() => setMode('login')}
          >
            登录
          </button>
          <button
            className={`tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => setMode('register')}
          >
            注册新账号
          </button>
        </div>

        <ErrorBox message={error} />

        <form onSubmit={submit}>
          <div className="field">
            <label>邮箱</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {mode === 'register' && (
            <>
              <div className="field">
                <label>用户名（ISH ID）</label>
                <input
                  required
                  pattern="[a-zA-Z0-9_\-]+"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="字母、数字、下划线"
                />
                <span className="help">
                  ISH 的用户 ID 与手机号、微信号解耦，这里不收集任何第三方身份。
                </span>
              </div>
              <div className="field">
                <label>显示名称</label>
                <input
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="field">
            <label>密码</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 位"
            />
          </div>
          <button className="btn brand" type="submit" disabled={busy}>
            {mode === 'login' ? '登录' : '注册并进入'}
          </button>
        </form>

        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '20px 0 14px' }} />
        <div className="kicker" style={{ marginBottom: 8 }}>
          演示账号（密码统一为 <code>{DEMO_PASSWORD}</code>）
        </div>
        <div className="row">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              className="btn small"
              disabled={busy}
              onClick={() => quickLogin(account.email)}
            >
              {account.label}
            </button>
          ))}
        </div>
        <p className="mini" style={{ marginTop: 14 }}>
          建议开两个浏览器窗口（一个正常、一个隐私模式），分别登录 alice 和 bob，
          才能真正跑完「发愿 → 申请 → 接受 → 立契 → 航标 → 作品」这条链。
        </p>
      </div>
    </div>
  )
}
