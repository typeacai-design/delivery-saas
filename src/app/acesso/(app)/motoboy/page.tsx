import { exigirFuncao } from '@/lib/equipe-guard'
import { MotoboyPainel } from '@/components/equipe/motoboy'

export const dynamic = 'force-dynamic'
export default async function MotoboyPage() {
  await exigirFuncao('motoboy')
  return <MotoboyPainel />
}
