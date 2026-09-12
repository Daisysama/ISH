import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { SESSION_COOKIE_NAME, verifySessionToken } from '@/backend/auth/session'

/**
 * 路由守卫。
 *
 * 这里只判断“是否登录”。管理员身份需要查用户邮箱和服务端配置，
 * 因此 /admin 的最终授权在页面和 Server Action 中再次校验。
 */

/** 需要登录才能看的路径。 */
const PROTECTED = ['/dashboard', '/meow', '/admin', '/profile']

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
