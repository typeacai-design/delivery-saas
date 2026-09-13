import { redirect } from 'next/navigation'
import { authenticatedTenant } from '@/lib/tenant-auth'
import VisaoGeralPage from '@/app/dashboard-view'

// Forçar render dinâmico — dados de vendas do dia devem sempre ser frescos
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const { role } = await authenticatedTenant(['owner', 'manager', 'attendant', 'kitchen', 'motoboy', 'delivery'])

  // Attendant: redireciona direto para pedidos
  if (role === 'attendant') {
    redirect('/pedidos')
  }

  return <VisaoGeralPage />
}
