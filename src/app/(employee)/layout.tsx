import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { TenantRole } from '@/lib/tenant-auth'

/**
 * EmployeeLayout — usado por /acesso/<perfil>.
 *
 * Arquitetura:
 * - Lojistas (owner/manager) NÃO podem renderizar nada aqui — redirect para /dashboard.
 * - Funcionários (attendant/kitchen/motoboy) podem renderizar.
 * - Não inclui sidebar administrativo, header de busca nem navegação de módulos.
 *
 * O guard roda SERVER-SIDE em paralelo com a renderização. Sem race condition,
 * sem flash de layout errado.
 */
export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/acesso')
  }

  const { data: members } = await supabase
    .from('usuarios_loja')
    .select('tenant_id, role, ativo')
    .eq('user_id', user.id)
    .eq('ativo', true)

  if (!members || members.length === 0) {
    // Sessão sem tenant — sem acesso a área de funcionário.
    redirect('/acesso')
  }

  const cookieStore = await cookies()
  const activeTenantId = cookieStore.get('wd_active_tenant')?.value
  const member = members.find((m) => m.tenant_id === activeTenantId) || members[0]
  const role = member?.role as TenantRole | undefined

  // Lojistas não pertencem à área de funcionário.
  if (role === 'owner' || role === 'manager') {
    redirect('/dashboard')
  }

  // Funcionário sem perfil operacional definido não tem onde cair.
  if (!role || !['attendant', 'kitchen', 'motoboy'].includes(role)) {
    redirect('/acesso')
  }

  return <>{children}</>
}
