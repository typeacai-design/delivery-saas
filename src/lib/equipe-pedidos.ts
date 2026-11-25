import type { SupabaseClient } from '@supabase/supabase-js'

/** Pedido como a cozinha vê: sem valores, sem telefone e sem endereço. */
export type PedidoCozinha = {
  id: string; codigo: string | null; status: string; tipo: 'delivery' | 'retirada' | 'mesa'
  mesa_numero: string | null; cliente_nome: string | null; criado_em: string; observacoes: string | null
  itens: { nome: string; quantidade: number; variante: string | null; observacao: string | null; complementos: { nome: string; quantidade: number }[] }[]
}

type Linha = Record<string, unknown>
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function tipoDoPedido(p: Linha): PedidoCozinha['tipo'] {
  if (p.tipo_pedido === 'mesa' || p.tipo_entrega === 'mesa' || p.sessao_mesa_id) return 'mesa'
  return p.tipo_entrega === 'retirada' ? 'retirada' : 'delivery'
}

/** Busca itens e número da mesa e monta só os campos permitidos. */
export async function montarPedidosCozinha(admin: SupabaseClient, tenantId: string, pedidos: Linha[]): Promise<PedidoCozinha[]> {
  if (!pedidos.length) return []
  const ids = pedidos.map(p => p.id as string)
  const sessoes = [...new Set(pedidos.map(p => p.sessao_mesa_id).filter(Boolean))] as string[]
  const [{ data: itens }, { data: mesas }] = await Promise.all([
    admin.from('pedido_itens').select('pedido_id, nome, quantidade, variante_nome, observacao, complementos').in('pedido_id', ids),
    sessoes.length ? admin.from('sessoes_mesa').select('id, mesa_numero').eq('tenant_id', tenantId).in('id', sessoes) : Promise.resolve({ data: [] as Linha[] }),
  ])
  const mesaPorSessao = new Map((mesas || []).map(m => [m.id as string, String(m.mesa_numero)]))
  const itensPorPedido = new Map<string, PedidoCozinha['itens']>()
  for (const item of itens || []) {
    const lista = itensPorPedido.get(item.pedido_id as string) || []
    const complementos = Array.isArray(item.complementos) ? item.complementos as Linha[] : []
    lista.push({
      nome: String(item.nome || ''), quantidade: Number(item.quantidade) || 1, variante: texto(item.variante_nome), observacao: texto(item.observacao),
      complementos: complementos.map(c => ({ nome: String(c.nome || ''), quantidade: Number(c.quantidade) || 1 })).filter(c => c.nome),
    })
    itensPorPedido.set(item.pedido_id as string, lista)
  }
  return pedidos.map(p => ({
    id: p.id as string, codigo: texto(p.codigo), status: String(p.status), tipo: tipoDoPedido(p),
    mesa_numero: p.sessao_mesa_id ? mesaPorSessao.get(p.sessao_mesa_id as string) || null : null,
    cliente_nome: texto(p.cliente_nome), criado_em: String(p.data_criacao || p.created_at), observacoes: texto(p.observacoes),
    itens: itensPorPedido.get(p.id as string) || [],
  }))
}

export const COLUNAS_PEDIDO_EQUIPE = 'id, codigo, status, tipo_pedido, tipo_entrega, sessao_mesa_id, cliente_nome, data_criacao, created_at, observacoes'
