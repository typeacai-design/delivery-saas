import { exigirFuncao } from '@/lib/equipe-guard'
import { GarcomMesas } from '@/components/equipe/garcom'

export const dynamic = 'force-dynamic'
export default async function GarcomPage() {
  await exigirFuncao('attendant')
  return <GarcomMesas />
}
