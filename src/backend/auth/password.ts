import bcrypt from 'bcryptjs'

/** bcrypt 只处理密码的前 72 字节，因此所有注册入口都必须按 UTF-8 字节数检查。 */
export const MAX_PASSWORD_BYTES = 72

/** 计算轮数。当前 Alpha 在安全性与交互延迟之间采用 10 轮。 */
const BCRYPT_ROUNDS = 10

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/** 邮箱统一小写，避免大小写不同被当成两个账号。 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** 返回 UTF-8 编码后的字节数。 */
export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}
