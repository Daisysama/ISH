import { PrismaClient } from '@prisma/client'

/**
 * 数据库连接。
 *
 * 开发模式下 Next.js 每次改代码都会重新加载模块，如果每次都 new 一个
 * PrismaClient，几十次热更新之后数据库连接数就爆了。所以把它挂在
 * globalThis 上复用；生产环境不会热更新，直接 new 就行。
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
