/** 登录/注册表单在前后端之间共享的状态类型。 */
export type FormState = {
  error?: string
  field?: 'email' | 'password' | 'displayName'
}
