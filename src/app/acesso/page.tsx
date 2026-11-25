import { redirect } from 'next/navigation'
import { authenticatedTenant } from '@/lib/tenant-auth'
import { FUNCOES_EQUIPE, INICIO_FUNCAO, ehFuncaoEquipe } from '@/lib/equipe'
import LoginEquipe from '@/components/equipe/login-equipe'

export const dynamic = 'force-dynamic'

/** Entrada da equipe (Cozinha, Garçom, Motoboy) por celular e senha. Quem já está logado vai direto para a sua tela. */
export default async function AcessoPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const auth = await authenticatedTenant([...FUNCOES_EQUIPE])
  if (auth.user && auth.tenantId && ehFuncaoEquipe(auth.role)) redirect(INICIO_FUNCAO[auth.role])
  const { erro } = await searchParams
  return <LoginEquipe semAcesso={erro === 'sem-acesso'} />
}
