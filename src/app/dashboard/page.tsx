import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { listProjectsByOwner, modeLabel } from '@/lib/projects'

export const metadata = { title: '工作台 · ISH' }

/**
 * 工作台。
 *
 * 现在只列「我发起的」。等「发现项目」做出来之后，这里要分成两块：
 * 我发起的、我参与的 —— 而别人的项目属于另一个页面，不该混进工作台。
 */
export default async function DashboardPage() {
  // 布局里已经挡过没登录的请求了。这里再取一次不是为了鉴权，
  // 是因为要拿 user.id 去查项目 —— 顺手把 null 的情况收掉让类型收敛。
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const projects = await listProjectsByOwner(user.id)

  return (
    <div className="page">
      <section className="hero">
        {/* 背景那层流动的光是纯装饰，对读屏软件没有意义，所以藏掉。 */}
        <div className="hero-aurora" aria-hidden="true" />

        {/* 一个愿都没有和已经有几个，是两种完全不同的处境：
            前者需要被说服「值得写下第一个」，后者需要知道「接下来干嘛」。
            同一句欢迎语对这两个人都是废话，所以分开写。 */}
        <div className="hero-inner">
          <span className="eyebrow">Idea → People → Trust → Execution</span>
          <h1 className="display">
            {projects.length > 0 ? (
              <>你已经立起了 {projects.length} 个愿</>
            ) : (
              <>有个想法？</>
            )}
          </h1>
          <p className="lede">
            {projects.length > 0
              ? '接下来是让它们被看见，然后找到愿意同行的人。'
              : '在 ISH，先有目标，人再因目标聚集。把它写下来，是这一切的第一步。'}
          </p>
          <Link href="/dashboard/new" className="btn btn-glow btn-inline">
            发愿
          </Link>
        </div>
      </section>

      {projects.length === 0 ? (
        <div className="wip">
          <span className="wip-badge">还空着</span>
          <h2>这里会列出你发起的项目</h2>
          <p>
            第一个愿不用想得太完整。写清楚要做什么、为什么、需要谁，
            剩下的交给愿意同行的人一起补。
          </p>
        </div>
      ) : (
        <section className="project-grid">
          {projects.map((p, i) => (
            <Link
              key={p.id}
              href={`/dashboard/projects/${p.id}`}
              className="project-card"
              // 逐个错开一点入场时间，让列表是「铺开」而不是「闪出来」。
              // 封顶在第 8 个：再往后延迟就变成「等半天才出来」了，
              // 项目多的人反而体验最差。
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <div className="project-card-top">
                <span className={`tag tag-${p.mode}`}>{modeLabel(p.mode)}</span>
                <span className="tag">{p.category}</span>
              </div>

              <h3>{p.title}</h3>
              <p>{p.summary}</p>

              <div className="project-needs">
                {p.needs.map((n) => (
                  <span key={n} className="need">
                    {n}
                  </span>
                ))}
              </div>

              <footer className="project-card-foot">
                <span>{p.createdAt.toLocaleDateString('zh-CN')} 立</span>
              </footer>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
