import { redirect } from 'next/navigation'

import { readSession } from '@/backend/auth/session'

/**
 * 已登录用户进入工作台；访客先看到公开项目，而不是被强制送去登录。
 * 这样 fromish.com 可以直接作为公开宣传入口。
 */
export default async function HomePage() {
  const userId = await readSession()
  redirect(userId ? '/dashboard' : '/projects')
}
