import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

/**
 * 会话管理。
 *
 * 登录状态存在一个 HttpOnly 的 cookie 里：
 *   - HttpOnly 意味着浏览器里的 JavaScript 读不到它，
 *     所以就算页面被注入了恶意脚本，也偷不走登录凭证。
 *   - cookie 里放的是一个签过名的 JWT，内容只有用户 id。
 *     签名用服务端的密钥，改一个字都会验签失败。
 *
 * 注意：签名 ≠ 加密。JWT 的内容是能被解出来看的，
 * 所以这里面只放 id，不放任何敏感信息。
 */

const COOKIE_NAME = 'ish_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 天

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET 没有设置，或者长度不足 32 位。检查 .env.local 文件。',
    )
  }
  return new TextEncoder().encode(secret)
}

/** 登录成功后调用：签发 token 并写进 cookie。 */
export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // 本地开发是 http，线上是 https。secure 一旦为 true，
    // 浏览器就只在 https 下发送这个 cookie，本地会登不上。
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

/** 登出时调用：把 cookie 删掉。 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

/**
 * 读取当前会话，返回用户 id。
 * 没登录、token 过期、或者签名对不上，都返回 null。
 */
export async function readSession(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

/**
 * 单独抽出来是因为 middleware 拿不到 cookies()，
 * 它只能从请求对象里取 token，然后调这个函数验证。
 */
export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    // 过期、签名不对、格式不对 —— 一律当作没登录。
    return null
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME
