'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { hashPassword, normalizeEmail, verifyPassword } from '@/lib/auth'
import { db } from '@/lib/db'
import { createSession, destroySession } from '@/lib/session'

/**
 * 这些函数标了 'use server'，意思是它们只在服务器上运行。
 * 浏览器里的表单提交后，Next.js 负责把数据送到服务器执行这里的代码，
 * 所以密码、数据库连接这些东西永远不会出现在浏览器里。
 */

/** 表单执行完之后返回给页面的东西：出错了就带一条错误信息。 */
export type FormState = {
  error?: string
  /** 哪个输入框出的问题，用来在对应的框下面显示提示。 */
  field?: 'email' | 'password' | 'displayName'
}

const registerSchema = z.object({
  email: z.string().trim().email('请填写有效的邮箱地址'),
  displayName: z
    .string()
    .trim()
    .min(1, '请填写显示名称')
    .max(50, '显示名称最长 50 个字'),
  password: z
    .string()
    .min(8, '密码至少 8 位')
    .max(72, '密码太长了（最多 72 个字符）'),
})

const loginSchema = z.object({
  email: z.string().trim().email('请填写有效的邮箱地址'),
  password: z.string().min(1, '请填写密码'),
})

// ---------------------------------------------------------------- 注册

export async function registerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    displayName: formData.get('displayName'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      error: first.message,
      field: first.path[0] as FormState['field'],
    }
  }

  const email = normalizeEmail(parsed.data.email)

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return { error: '这个邮箱已经注册过了', field: 'email' }
  }

  const user = await db.user.create({
    data: {
      email,
      displayName: parsed.data.displayName,
      passwordHash: await hashPassword(parsed.data.password),
    },
  })

  await createSession(user.id)

  // redirect 是通过抛异常实现的，所以必须放在 try/catch 外面，
  // 否则会被当成错误吞掉。
  redirect('/dashboard')
}

// ---------------------------------------------------------------- 登录

export async function loginAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      error: first.message,
      field: first.path[0] as FormState['field'],
    }
  }

  const user = await db.user.findUnique({
    where: { email: normalizeEmail(parsed.data.email) },
  })

  // 账号不存在和密码错误返回同一句话。
  // 如果分开提示，别人就能靠这个接口把哪些邮箱注册过全试出来。
  const invalid: FormState = { error: '邮箱或密码不正确', field: 'password' }

  if (!user) {
    // 即使用户不存在也算一次哈希，让两种情况的耗时接近，
    // 否则响应快慢本身就泄露了「这个邮箱存不存在」。
    await hashPassword(parsed.data.password)
    return invalid
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash)
  if (!ok) return invalid

  await createSession(user.id)
  redirect('/dashboard')
}

// ---------------------------------------------------------------- 登出

export async function logoutAction(): Promise<void> {
  await destroySession()
  redirect('/login')
}
