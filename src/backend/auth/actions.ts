'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import {
  hashPassword,
  MAX_PASSWORD_BYTES,
  normalizeEmail,
  utf8ByteLength,
  verifyPassword,
} from '@/backend/auth/password'
import { createSession, destroySession } from '@/backend/auth/session'
import { db } from '@/backend/database/client'
import type { FormState } from '@/shared/auth'

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
    .refine((value) => utf8ByteLength(value) <= MAX_PASSWORD_BYTES, {
      message: '密码太长了（UTF-8 编码后最多 72 字节）',
    }),
})

const loginSchema = z.object({
  email: z.string().trim().email('请填写有效的邮箱地址'),
  password: z.string().min(1, '请填写密码'),
})

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
  redirect('/dashboard')
}

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

  const invalid: FormState = { error: '邮箱或密码不正确', field: 'password' }

  if (!user) {
    // 保持不存在账号与错误密码的耗时接近，降低账号枚举风险。
    await hashPassword(parsed.data.password)
    return invalid
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash)
  if (!ok) return invalid

  await createSession(user.id)
  redirect('/dashboard')
}

export async function logoutAction(): Promise<void> {
  await destroySession()
  redirect('/login')
}
