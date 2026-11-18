import Link from 'next/link'
import { dataFatura, FINANCEIRO_FATURAS, nomeCompetencia, situacaoFatura } from '@/lib/assinaturas'
import { faturasDoLojista, assinaturaVencida } from '@/lib/assinaturas-server'
import { redirect } from 'next/navigation'
import { authenticatedTenant } from '@/lib/tenant-auth'
import VisaoGeralPage from '@/app/dashboard-view'

// Forçar render dinâmico — dados de vendas do dia devem sempre ser frescos
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const { role, tenantId } = await authenticatedTenant(['owner', 'manager', 'attendant', 'kitchen', 'motoboy', 'delivery'])

  // Attendant: redireciona direto para pedidos
  if (role === 'attendant') {
    redirect('/pedidos')
  }

  const podeVerFaturas = tenantId && (role === 'owner' || role === 'manager')
  const [faturas, vencida] = podeVerFaturas
    ? await Promise.all([faturasDoLojista(tenantId), assinaturaVencida(tenantId)])
    : [[], false] as const
  const atual = faturas.find(fatura => !fatura.pago_em)

  return <>
    {atual && (
      <aside className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4" aria-label="Fatura da assinatura">
        <div>
          <strong>Sua fatura de {nomeCompetencia(atual.competencia)} já está disponível.</strong>
          <p className="hint text-sm">{situacaoFatura(atual) === 'Vencida' ? 'Venceu em' : 'Vence em'} {dataFatura(atual.vencimento)}.</p>
          {vencida && <p className="mt-1 text-sm font-medium text-red-700">Os pedidos estão bloqueados até a confirmação do pagamento das faturas vencidas.</p>}
        </div>
        <Link href={FINANCEIRO_FATURAS} className="btn-primary">Ver faturas</Link>
      </aside>
    )}
    <VisaoGeralPage />
  </>
}
