import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-auth'
import { ToastProvider } from '@/components/toast'
import AdminShell from './admin-shell'
import './admin.css'

export default async function AdminMainLayout({ children }: { children: React.ReactNode }) {
  if (!(await getAdminSession())) redirect('/painel-admin/login')
  return <ToastProvider><AdminShell>{children}</AdminShell></ToastProvider>
}
