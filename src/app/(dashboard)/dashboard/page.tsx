import VisaoGeralPage from '@/app/dashboard-view'

// Forçar render dinâmico — dados de vendas do dia devem sempre ser frescos
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function DashboardPage() {
  return <VisaoGeralPage />
}
