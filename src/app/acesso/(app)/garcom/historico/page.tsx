import { exigirFuncao } from '@/lib/equipe-guard'
import { GarcomHistorico } from '@/components/equipe/garcom'

export const dynamic = 'force-dynamic'
export default async function GarcomHistoricoPage() {
  await exigirFuncao('attendant')
  return <GarcomHistorico />
}
