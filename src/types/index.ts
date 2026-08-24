export type Tenant = {
  id: string
  nome: string
  slug: string
  cnpj: string
  config: Record<string, unknown>
  logo_url: string | null
  cor_principal: string | null
  tipo_estabelecimento: 'pizzaria' | 'hamburgueria' | 'acaiteria' | 'outros'
  valor_mensalidade: number
  created_at: string
  updated_at: string
}

export type Categoria = {
  id: string
  tenant_id: string
  nome: string
  ordem: number
  ativo: boolean
  created_at: string
}

export type Produto = {
  id: string
  tenant_id: string
  categoria_id: string | null
  nome: string
  descricao: string | null
  imagem_url: string | null
  preco: number
  ativo: boolean
  created_at: string
}

export type Variante = {
  id: string
  produto_id: string
  nome: string
  preco_adicional: number
}

export type Complemento = {
  id: string
  tenant_id: string
  nome: string
  preco: number
  ativo: boolean
}

export type Cliente = {
  id: string
  tenant_id: string
  nome: string
  telefone: string
  cep: string | null
  endereco: string | null
  bairro: string | null
  referencia: string | null
  created_at: string
}

export type PedidoStatus = 'novo' | 'preparando' | 'pronto' | 'saiu' | 'entregue' | 'cancelado'

export type Pedido = {
  id: string
  tenant_id: string
  cliente_id: string | null
  cliente_nome?: string
  cliente_whatsapp?: string
  codigo?: string
  status: PedidoStatus
  valor_total: number
  taxa_entrega: number
  forma_pagamento: string[]
  valor_pago: number[]
  troco: number
  troco_para?: number
  agendamento: string | null
  observacoes: string | null
  tipo_entrega?: string
  endereco_entrega?: string
  numero_entrega?: string
  complemento_entrega?: string
  bairro_entrega?: string
  valor_subtotal?: number
  valor_desconto?: number
  cupom_aplicado?: string
  tempo_estimado_min?: number
  motoboy_id?: string
  motoboy_comissao?: number
  data_criacao: string
  data_atualizacao: string
  deleted_at?: string | null
  apagado_por?: string | null
  pago?: boolean
  pago_em?: string
  pago_por?: string
}

export type PedidoItem = {
  id: string
  pedido_id: string
  produto_id: string | null
  variante_id: string | null
  nome: string
  quantidade: number
  valor_unitario: number
  grupo: string | null
}

export type PedidoComplemento = {
  id: string
  pedido_item_id: string
  complemento_id: string | null
  nome: string
  quantidade: number
  valor: number
}

export type Insumo = {
  id: string
  tenant_id: string
  nome: string
  unidade: string
  quantidade_atual: number
  estoque_minimo: number
  custo_unitario: number
}

export type EnderecoEntrega = {
  id: string
  tenant_id: string
  bairro: string
  taxa: number
}

// Carrinho
export type CartItem = {
  produto: Produto
  variante: Variante | null
  quantidade: number
  complementos: Complemento[]
}

export type Cart = {
  tenant_id: string
  items: CartItem[]
}
