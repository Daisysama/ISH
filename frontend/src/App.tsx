import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import CreateWishPage from './pages/CreateWishPage'
import DiscoverPage from './pages/DiscoverPage'
import LoginPage from './pages/LoginPage'
import MyProjectsPage from './pages/MyProjectsPage'
import PortfolioPage from './pages/PortfolioPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import TrustPage from './pages/TrustPage'
import WorksPage from './pages/WorksPage'
import { useApp } from './state/AppContext'

const NAV = [
  { to: '/discover', label: '发现项目', uc: 'UC-02' },
  { to: '/create', label: '发愿', uc: 'UC-01' },
  { to: '/mine', label: '我的项目', uc: 'UC-03/04' },
  { to: '/portfolio', label: '项目履历', uc: 'UC-05' },
  { to: '/works', label: '作品与推荐', uc: 'UC-06/07/08' },
  { to: '/trust', label: '透明度与信任', uc: 'UC-09' },
]

export default function App() {
  const { me, loading, logout, toast, notify } = useApp()
  const navigate = useNavigate()

  if (loading) {
    return <div className="login">正在连接 ISH…</div>
  }

  if (!me) {
    return (
      <>
        <LoginPage />
        {toast && <div className={`toast${toast.bad ? ' bad' : ''}`}>{toast.text}</div>}
      </>
    )
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandmark">ISH</div>
          <div>
            <h1>伊始</h1>
            <small>Idea → People → Work</small>
          </div>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}
            >
              <span>{item.label}</span>
              <span className="uc">{item.uc}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="avatar">{me.display_name.slice(0, 1)}</span>
            <div>
              <div style={{ fontSize: 13, color: 'var(--ink)' }}>{me.display_name}</div>
              <div>@{me.handle}{me.is_curator ? ' · ISH 编辑' : ''}</div>
            </div>
          </div>
          <button
            className="btn small ghost"
            onClick={async () => {
              await logout()
              notify('已退出登录')
              navigate('/discover')
            }}
          >
            退出登录
          </button>
          <div style={{ marginTop: 10 }}>
            API 文档：
            <a href="/api/docs" target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>
              /api/docs
            </a>
          </div>
        </div>
      </aside>

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/discover" replace />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/create" element={<CreateWishPage />} />
          <Route path="/mine" element={<MyProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/works" element={<WorksPage />} />
          <Route path="/trust" element={<TrustPage />} />
          <Route path="*" element={<div className="empty">页面不存在</div>} />
        </Routes>
      </main>

      {toast && <div className={`toast${toast.bad ? ' bad' : ''}`}>{toast.text}</div>}
    </div>
  )
}
