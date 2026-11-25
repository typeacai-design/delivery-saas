import type { SupabaseClient } from '@supabase/supabase-js'

/** Como as entregas prontas chegam aos motoboys (Configuração do lojista em Equipe). */
export type ModoDistribuicao = 'motoboys_escolhem' | 'lojista_escolhe' | 'automatico'
export const MODOS_DISTRIBUICAO: ModoDistribuicao[] = ['motoboys_escolhem', 'lojista_escolhe', 'automatico']
export const NOME_MODO: Record<ModoDistribuicao, string> = {
  motoboys_escolhem: 'Motoboys escolhem',
  lojista_escolhe: 'Lojista escolhe',
  automatico: 'Automático, por ordem',
}
export const modoDistribuicao = (config: unknown): ModoDistribuicao => {
  const valor = (config as Record<string, unknown> | null)?.entrega_distribuicao
  return MODOS_DISTRIBUICAO.includes(valor as ModoDistribuicao) ? valor as ModoDistribuicao : 'motoboys_escolhem'
}

export const ehEntrega = (p: { tipo_pedido?: unknown; tipo_entrega?: unknown; sessao_mesa_id?: unknown }) =>
  p.tipo_pedido !== 'mesa' && p.tipo_entrega !== 'mesa' && !p.sessao_mesa_id && p.tipo_entrega !== 'retirada'

export async function motoboysDisponiveis(admin: SupabaseClient, tenantId: string) {
  const { data } = await admin.from('usuarios_loja').select('user_id, nome')
    .eq('tenant_id', tenantId).eq('role', 'motoboy').eq('ativo', true).eq('disponivel', true)
  return data || []
}

/**
 * Modo automático: entrega pronta e sem entregador vai para o motoboy disponível com menos entregas em
 * andamento; empate fica com quem recebeu entrega há mais tempo (fila por ordem).
 * A atribuição é condicional (entregador_id ainda nulo), então duas chamadas simultâneas não duplicam.
 */
export async function distribuirAutomatico(admin: SupabaseClient, tenantId: string) {
  const { data: tenant } = await admin.from('tenants').select('config').eq('id', tenantId).single()
  if (modoDistribuicao(tenant?.config) !== 'automatico') return 0
  const { data: pendentes } = await admin.from('pedidos').select('id, tipo_pedido, tipo_entrega, sessao_mesa_id')
    .eq('tenant_id', tenantId).eq('status', 'pronto').is('entregador_id', null).is('deleted_at', null).order('data_criacao', { ascending: true }).limit(30)
  const entregas = (pendentes || []).filter(ehEntrega)
  if (!entregas.length) return 0
  const disponiveis = await motoboysDisponiveis(admin, tenantId)
  if (!disponiveis.length) return 0

  const { data: emAndamento } = await admin.from('pedidos').select('entregador_id, entregador_em, status')
    .eq('tenant_id', tenantId).in('entregador_id', disponiveis.map(m => m.user_id))
    .gte('entregador_em', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  const carga = new Map(disponiveis.map(m => [m.user_id as string, { ativas: 0, ultima: 0 }]))
  for (const p of emAndamento || []) {
    const c = carga.get(p.entregador_id as string); if (!c) continue
    if (p.status === 'pronto' || p.status === 'saiu') c.ativas += 1
    c.ultima = Math.max(c.ultima, new Date(p.entregador_em as string).getTime() || 0)
  }
  let atribuidas = 0
  for (const entrega of entregas) {
    const [escolhido] = [...carga.entries()].sort((a, b) => a[1].ativas - b[1].ativas || a[1].ultima - b[1].ultima)
    if (!escolhido) break
    const agora = new Date().toISOString()
    const { data } = await admin.from('pedidos').update({ entregador_id: escolhido[0], entregador_em: agora })
      .eq('id', entrega.id).eq('tenant_id', tenantId).is('entregador_id', null).eq('status', 'pronto').select('id').maybeSingle()
    if (data) { escolhido[1].ativas += 1; escolhido[1].ultima = Date.now(); atribuidas += 1 }
  }
  return atribuidas
}
