import Link from 'next/link'
import { ALL_TENANT_ROLES, authenticatedTenant } from '@/lib/tenant-auth'
import { assinaturaVencida } from '@/lib/assinaturas-server'
import { FINANCEIRO_FATURAS, PEDIDOS_BLOQUEADOS } from '@/lib/assinaturas'

export default async function PedidosLayout({ children }: { children: React.ReactNode }) {
  const { tenantId } = await authenticatedTenant(ALL_TENANT_ROLES)
  if (!tenantId || !(await assinaturaVencida(tenantId))) return children

  return <section className="glass rounded-2xl p-6">
    <h1 className="mb-2 text-2xl font-semibold">Pedidos bloqueados</h1>
    <p className="mb-4">{PEDIDOS_BLOQUEADOS}</p>
    <Link href={FINANCEIRO_FATURAS} className="btn-primary">Ver faturas</Link>
  </section>
}
