import { redirect } from 'next/navigation'

import { readSession } from '@/lib/session'

/** 根路径不显示内容，只按登录状态把人送到该去的地方。 */
export default async function HomePage() {
  const userId = await readSession()
  redirect(userId ? '/dashboard' : '/login')
}
