import { redirect } from 'next/navigation'

/** 旧链接保留；访问授权由统一的管理员与授权记录页核验。 */
export default function GovernanceLogRedirect() {
  redirect('/admin/staff#authorization-log')
}
