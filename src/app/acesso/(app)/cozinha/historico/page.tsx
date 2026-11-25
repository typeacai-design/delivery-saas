import { exigirFuncao } from '@/lib/equipe-guard'
import { CozinhaHistorico } from '@/components/equipe/cozinha'

export const dynamic = 'force-dynamic'
export default async function CozinhaHistoricoPage() {
  await exigirFuncao('kitchen')
  return <CozinhaHistorico />
}
