import { exigirFuncao } from '@/lib/equipe-guard'
import { CozinhaFluxo } from '@/components/equipe/cozinha'

export const dynamic = 'force-dynamic'
export default async function CozinhaPage() {
  await exigirFuncao('kitchen')
  return <CozinhaFluxo />
}
