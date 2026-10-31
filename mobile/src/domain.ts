export type Store = { id: string; nome: string; logo_url: string | null; status: string; bloqueado: boolean; loja_aberta_manual: boolean | null }
export const stages = ['novo', 'preparando', 'pronto', 'saiu', 'entregue', 'cancelado'] as const
export type Stage = typeof stages[number]
export const stageLabels: Record<Stage, string> = { novo: 'Novo', preparando: 'Preparando', pronto: 'Pronto', saiu: 'Saiu', entregue: 'Entregue', cancelado: 'Cancelado' }
export type AddOn = { nome: string; quantidade: number; valor?: number | string }
export type OrderItem = { id: string; nome: string; quantidade: number; observacao: string | null; variante_nome?: string | null; complementos: unknown; pedido_complementos: AddOn[] }
export type Order = { id: string; codigo: string | null; status: Stage; valor_total: number | string; data_criacao: string; cliente_nome: string | null; forma_pagamento: string[] | null; endereco_entrega: string | null; numero_entrega: string | null; complemento_entrega: string | null; bairro_entrega: string | null; observacoes: string | null; tipo_entrega: string; pago: boolean; pedido_itens: OrderItem[] }
export type Product = { id: string; categoria_id: string | null; nome: string; imagem_url: string | null; preco: number | string; pontos: number; ativo: boolean; ordem: number; exibir_preco_a_partir_de: boolean }
export type Category = { id: string; nome: string; ordem: number }
export type Period = 'hoje' | 'ontem'
export function dateRange(period: Period, now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (period === 'ontem' ? 1 : 0))
  const until = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
  return { from: from.toISOString(), until: until.toISOString() }
}
export function money(value: number | string) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0) }
export function canUseStore(store: Pick<Store, 'status' | 'bloqueado'>) { return store.status === 'active' && !store.bloqueado }
export function addons(item: OrderItem): AddOn[] {
  if (item.pedido_complementos?.length) return item.pedido_complementos
  if (!Array.isArray(item.complementos)) return []
  return item.complementos.filter((x): x is AddOn => Boolean(x && typeof x === 'object' && typeof x.nome === 'string')).map(x => ({ ...x, quantidade: Number(x.quantidade) || 1 }))
}
export function oauthCode(url: string, expected: string) {
  const actual = new URL(url), callback = new URL(expected)
  if (actual.protocol !== callback.protocol || actual.host !== callback.host || actual.pathname !== callback.pathname) throw new Error('Retorno do Google inválido.')
  if (actual.searchParams.has('error')) throw new Error('Não foi possível concluir o acesso com Google.')
  const code = actual.searchParams.get('code')
  if (!code) throw new Error('O Google não retornou um código de acesso.')
  return code
}
