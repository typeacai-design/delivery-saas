import { redirect } from 'next/navigation'
import { authenticatedTenant } from '@/lib/tenant-auth'
import { FUNCOES_EQUIPE, INICIO_FUNCAO, ehFuncaoEquipe, type FuncaoEquipe } from '@/lib/equipe'

/** Garante (no servidor) que quem abre a página é da equipe com esta função; senão manda para a tela certa. */
export async function exigirFuncao(funcao?: FuncaoEquipe) {
  const auth = await authenticatedTenant(['owner', 'manager', ...FUNCOES_EQUIPE])
  if (!auth.user) redirect('/acesso')
  if (auth.role === 'owner' || auth.role === 'manager') redirect('/dashboard')
  if (!auth.tenantId || !ehFuncaoEquipe(auth.role)) redirect('/acesso?erro=sem-acesso')
  if (funcao && auth.role !== funcao) redirect(INICIO_FUNCAO[auth.role])
  return { funcao: auth.role as FuncaoEquipe, tenantId: auth.tenantId }
}
