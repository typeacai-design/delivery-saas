import { exigirFuncao } from '@/lib/equipe-guard'
import EquipeShell from '@/components/equipe/equipe-shell'

/** Área da equipe: só Cozinha, Garçom e Motoboy. Cada um vê apenas o menu da sua função. */
export default async function AreaEquipeLayout({ children }: { children: React.ReactNode }) {
  const { funcao, tenantId } = await exigirFuncao()
  return <EquipeShell funcao={funcao} tenantId={tenantId!}>{children}</EquipeShell>
}
