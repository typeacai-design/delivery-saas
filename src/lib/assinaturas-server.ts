import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { dataBrasilia, type Fatura } from './assinaturas'

export const camposFatura = 'id,tenant_id,loja_nome,competencia,faturamento_centavos,valor_centavos,vencimento,pago_em,checkout_url'

export function billingClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const assinaturaVencida = cache(async (tenantId: string): Promise<boolean> => {
  const { data, error } = await billingClient().from('faturas_assinatura').select('id')
    .eq('tenant_id', tenantId).lt('vencimento', dataBrasilia()).is('pago_em', null)
    .not('checkout_url', 'is', null).limit(1)
  if (error) throw error
  return Boolean(data.length)
})

export async function faturasDoLojista(tenantId: string) {
  const { data, error } = await billingClient().from('faturas_assinatura').select(camposFatura)
    .eq('tenant_id', tenantId).not('checkout_url', 'is', null)
    .order('pago_em', { ascending: false, nullsFirst: true }).order('competencia', { ascending: false }).limit(36).returns<Fatura[]>()
  if (error) throw error
  return data
}

export async function situacaoDasLojas() {
  const aberto = new Set<string>()
  const vencido = new Set<string>()
  const admin = billingClient()
  const hoje = dataBrasilia()
  const tamanho = 500
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await admin.from('faturas_assinatura').select('tenant_id,vencimento')
      .not('tenant_id', 'is', null).is('pago_em', null).not('checkout_url', 'is', null).order('id').range(inicio, inicio + tamanho - 1)
    if (error) throw error
    for (const fatura of data) {
      aberto.add(fatura.tenant_id)
      if (fatura.vencimento < hoje) vencido.add(fatura.tenant_id)
    }
    if (data.length < tamanho) return { aberto, vencido }
  }
}
