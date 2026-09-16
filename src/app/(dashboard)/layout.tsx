import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { TenantRole } from '@/lib/tenant-auth'
import DashboardShell from './dashboard-shell'

/**
 * Server-side guard do AdminLayout (lojista).
 *
 * Roda antes da renderização do shell client. Se o usuário não for lojista,
 * redireciona ANTES de qualquer HTML ser gerado — sem flash de layout errado.
 *
 * - Sem sessão → /login
 * - Sessão sem membership → /login?error=access
 * - Role operacional (attendant/kitchen/motoboy/delivery) → /acesso/<perfil>
 * - Tenant pending_approval → /aguardando-aprovacao
 * - Tenant inativo/suspenso → /login?error=inactive
 * - Lojista OK → renderiza o DashboardShell já com tenant e role populados
 *   (client não precisa refazer fetch só pra descobrir que é lojista).
 */
export default async function DashboardLayoutServer({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const cookieStore = await cookies()
  const activeTenantId = cookieStore.get('wd_active_tenant')?.value

  const { data: members } = await supabase
    .from('usuarios_loja')
    .select('tenant_id, role, ativo')
    .eq('user_id', user.id)
    .eq('ativo', true)

  if (!members || members.length === 0) {
    redirect('/login?error=access')
  }

  // Mesma ordenação do tenant-auth: owner primeiro.
  const ordered = [...members].sort((a, b) =>
    (a.role === 'owner' ? 0 : 1) - (b.role === 'owner' ? 0 : 1)
    || a.tenant_id.localeCompare(b.tenant_id)
  )
  const member = (activeTenantId && ordered.find((m) => m.tenant_id === activeTenantId))
    || ordered[0]
  const role = member?.role as TenantRole | undefined

  if (!role) redirect('/login?error=access')

  // Perfis operacionais não podem renderizar o AdminLayout.
  // Redireciona para a tela dedicada ANTES do HTML ser gerado.
  if (role === 'attendant' || role === 'kitchen' || role === 'motoboy' || role === 'delivery') {
    const destino =
      role === 'attendant' ? '/acesso/atendimento'
      : role === 'kitchen' ? '/acesso/cozinha'
      : role === 'motoboy' ? '/acesso/motoboy'
      : '/pedidos' // delivery
    redirect(destino)
  }

  // Validação do tenant ativo.
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, nome, status')
    .eq('id', member.tenant_id)
    .maybeSingle()

  if (!tenant) redirect('/login?error=inactive')
  if (tenant.status === 'pending_approval') redirect('/aguardando-aprovacao')
  if (tenant.status !== 'active') redirect('/login?error=inactive')

  return (
    <DashboardShell
      tenantFromServer={{ id: tenant.id, nome: tenant.nome, status: tenant.status }}
      roleFromServer={role}
    >
      {children}
    </DashboardShell>
  )
}
