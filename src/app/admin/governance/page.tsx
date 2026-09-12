import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/backend/auth/current-user'
import { getSiteAccess } from '@/backend/auth/admin'
import { GlobalHeader } from '@/frontend/components/brand/GlobalHeader'

export const metadata = { title: '网站治理工作台 · FromISH', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function GovernanceHubPage() {
  const user = await getCurrentUser()
  if (!user) notFound()
  const access = await getSiteAccess(user.id)
  const sections = ([
    { permission: 'REPORT_REVIEW', href: '/admin/reports', title: '项目与动态举报', description: '核查公开项目、动态举报及作者对下架的申诉。' },
    { permission: 'REPORT_REVIEW', href: '/admin/comments', title: '评论审核与举报', description: '处理自动暂缓、评论举报及独立申诉。' },
    { permission: 'REPORT_REVIEW', href: '/admin/user-reports', title: '用户举报审核', description: '独立查核用户行为；举报不会自动成为处分。' },
    { permission: 'CONTENT_POLICY', href: '/admin/content-rules', title: '自动筛查规则', description: '维护文字规则与变更理由，检查误判。' },
    { permission: 'USER_SANCTION', href: '/admin/sanctions', title: '账号处分', description: '有依据地限制发布或账号管理，站主可撤销。' },
    { permission: 'SANCTION_APPEAL_REVIEW', href: '/admin/sanction-appeals', title: '账号处分申诉', description: '独立审核不是自己作出的处分。' },
    { permission: 'GOVERNANCE_LOG_VIEW', href: '/admin/staff', title: '网站管理员与授权记录', description: '查看授权、调整与撤销记录。' },
  ] as const).filter(item => access.permissions.includes(item.permission))
  if (access.role === 'USER') notFound()
  return <><GlobalHeader active="governance" /><main className="moderation-shell shell-with-header">
    <span className="eyebrow">SITE GOVERNANCE</span><h1>网站治理</h1>
    <p>每项能力单独授权。网站管理员的处理、站主纠错与当事人申诉，各自保留记录。</p>
    <div className="governance-link-grid">
      {access.role === 'OWNER' && <Link className="panel governance-link" href="/admin/staff"><h2>网站管理员与授权记录</h2><p>授权、撤销权限，以及核查没有独立审查员的待办。</p><span>前往 →</span></Link>}
      {access.role === 'OWNER' && <Link className="panel governance-link" href="/admin/users"><h2>用户治理记录</h2><p>按稳定用户 ID 查找已审结的处分与举报。</p><span>前往 →</span></Link>}
      {access.role === 'OWNER' && <Link className="panel governance-link" href="/admin/announcements"><h2>公告操作记录</h2><p>查看公告删除和编辑记录，恢复已删除公告。</p><span>前往 →</span></Link>}
      {access.role === 'ADMIN' && <Link className="panel governance-link" href="/admin/users"><h2>用户治理记录</h2><p>查看账号处分和已经审结的举报；未核实举报不会算违规。</p><span>前往 →</span></Link>}
      {sections.filter(item => access.role !== 'OWNER' || item.href !== '/admin/staff').map(item => <Link className="panel governance-link" key={item.href} href={item.href}>
        <h2>{item.title}</h2><p>{item.description}</p><span>前往 →</span>
      </Link>)}
    </div>
  </main></>
}
