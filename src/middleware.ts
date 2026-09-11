import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { SESSION_COOKIE_NAME, verifySessionToken } from '@/backend/auth/session'

/**
 * 路由守卫。
 *
 * 这段代码在**服务器上**运行，在页面被送给浏览器之前。
 * 所以没登录的人根本拿不到 dashboard 的内容 ——
 * 不是「先发给你再用 JS 把你踢走」，是压根不发。
 */

/** 需要登录才能看的路径。 */
const PROTECTED = ['/dashboard']

/** 已经登录的人不该再看到的路径（登录页、注册页）。 */
const AUTH_ONLY = ['/login', '/register']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const userId = token ? await verifySessionToken(token) : null
  const isLoggedIn = userId !== null

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !isLoggedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // 记住他本来想去哪，登录完直接送过去。
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (AUTH_ONLY.some((p) => pathname.startsWith(p)) && isLoggedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // 跳过静态资源，免得每张图片都跑一遍这段逻辑。
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
