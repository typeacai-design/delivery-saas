import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-auth'
import AdminShell from './admin-shell'

export default async function AdminMainLayout({ children }: { children: React.ReactNode }) {
  if (!(await getAdminSession())) redirect('/painel-admin/login')
  return <AdminShell>{children}</AdminShell>
}
