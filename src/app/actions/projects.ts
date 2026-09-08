'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { CATEGORIES, MODES } from '@/lib/projects'

/** 表单执行完之后返回给页面的东西：出错了就带一条错误信息。 */
export type ProjectFormState = {
  error?: string
  field?: 'title' | 'summary' | 'category' | 'mode' | 'needs'
}

/**
 * 校验规则在服务端。
 *
 * 表单上也标了 required、maxlength，但那些只是为了让人填的时候有反馈 ——
 * 浏览器里的限制随手就能绕过去，真正说了算的是这里。
 */
const createSchema = z.object({
  title: z
    .string()
    .trim()
    .min(4, '标题太短了，至少 4 个字')
    .max(60, '标题最长 60 个字，把细节留给下面的正文'),
  summary: z
    .string()
    .trim()
    .min(30, '再多写一点：为什么做、做到什么程度算成（至少 30 个字）')
    .max(2000, '正文最长 2000 个字'),
  category: z.enum(CATEGORIES, { message: '请选择一个领域' }),
  mode: z.enum(
    MODES.map((m) => m.value) as [string, ...string[]],
    { message: '请选择投入预期' },
  ),
  needs: z
    .array(z.string().trim().min(1).max(12))
    .min(1, '至少写一个你需要的同行者类型')
    .max(8, '最多 8 个 —— 什么都需要，等于没说'),
})

// ---------------------------------------------------------------- 发愿

export async function createProjectAction(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  // middleware 已经挡过一次没登录的请求，但 server action 是一个可以被直接
  // POST 的接口，不能只靠页面路由的保护。这里必须自己再确认一次。
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const parsed = createSchema.safeParse({
    title: formData.get('title'),
    summary: formData.get('summary'),
    category: formData.get('category'),
    mode: formData.get('mode'),
    // 同名的多个字段用 getAll 取；去掉空值和重复项。
    needs: [
      ...new Set(
        formData
          .getAll('needs')
          .map((n) => String(n).trim())
          .filter(Boolean),
      ),
    ],
  })

  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      error: first.message,
      field: first.path[0] as ProjectFormState['field'],
    }
  }

  const project = await db.project.create({
    data: { ...parsed.data, ownerId: user.id },
  })

  // 工作台上的项目列表是服务端渲染并缓存的，不主动失效的话
  // 跳回去会看到一个还没有这个新项目的旧页面。
  revalidatePath('/dashboard')

  // redirect 是通过抛异常实现的，所以必须放在 try/catch 外面。
  redirect(`/dashboard/projects/${project.id}`)
}
