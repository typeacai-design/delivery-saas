import { supabase } from './supabase'
import { dateRange, type Store, type Order, type Period, type Stage, type Category, type Product } from './domain'

export async function stores(signal: AbortSignal): Promise<Store[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Sua sessão expirou. Entre novamente.')
  const { data: memberships, error } = await supabase.from('usuarios_loja').select('tenant_id,role').eq('user_id', user.id).eq('ativo', true).in('role', ['owner', 'manager']).abortSignal(signal)
  if (error) throw new Error('Não foi possível verificar seu acesso às lojas.')
  if (!memberships?.length) return []
  const { data, error: storeError } = await supabase.from('tenants').select('id,nome,logo_url,status,bloqueado,loja_aberta_manual').in('id', memberships.map(m => m.tenant_id)).order('nome').abortSignal(signal)
  if (storeError) throw new Error('Não foi possível carregar suas lojas.')
  return data || []
}
const orderFields = 'id,codigo,status,valor_total,data_criacao,cliente_nome,cliente_whatsapp,forma_pagamento,endereco_entrega,numero_entrega,complemento_entrega,bairro_entrega,observacoes,tipo_entrega,pago,pedido_itens(id,nome,quantidade,observacao,variante_nome,complementos,pedido_complementos(nome,quantidade,valor))'
export async function orders(storeId: string, period: Period, stage: Stage, page: number, signal: AbortSignal) {
  const range = dateRange(period)
  const { data, error, count } = await supabase.from('pedidos').select(orderFields, { count: 'exact' }).eq('tenant_id', storeId).is('deleted_at', null).eq('status', stage).gte('data_criacao', range.from).lt('data_criacao', range.until).order('data_criacao', { ascending: false }).order('id', { ascending: false }).range(page * 25, page * 25 + 24).abortSignal(signal)
  if (error) throw new Error('Não foi possível carregar os pedidos. Tente novamente.')
  return { orders: (data || []) as unknown as Order[], count: count || 0 }
}
export async function counts(storeId: string, signal: AbortSignal) {
  const range = dateRange('hoje')
  const base = () => supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('tenant_id', storeId).is('deleted_at', null).gte('data_criacao', range.from).lt('data_criacao', range.until)
  const [all, fresh] = await Promise.all([base().abortSignal(signal), base().eq('status', 'novo').abortSignal(signal)])
  if (all.error || fresh.error) throw new Error('Não foi possível atualizar os indicadores.')
  return { today: all.count || 0, fresh: fresh.count || 0 }
}
export async function catalog(storeId: string, signal: AbortSignal) {
  const categories = await supabase.from('categorias').select('id,nome,ordem').eq('tenant_id', storeId).order('ordem').abortSignal(signal)
  if (categories.error) throw new Error('Não foi possível carregar as seções.')
  const products: Product[] = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.from('produtos').select('id,categoria_id,nome,descricao,imagem_url,imagem_path,preco,preco_riscado,pontos,ativo,ordem,exibir_preco_a_partir_de,codigo_externo,tempo_preparo_min,eh_adicional,disponivel_mesa,disponivel_delivery,disponivel_retirada,etiquetas,pode_ser_metade,texto_metade,fracionar_item,dias_disponiveis,horario_inicio,horario_fim,limite_vendas_dia,limite_vendas_turno,controlar_estoque,quantidade_estoque,sabores_grupo_id,sabores_maximo').eq('tenant_id', storeId).is('deleted_at', null).order('ordem').order('id').range(offset, offset + 99).abortSignal(signal)
    if (error) throw new Error('Não foi possível carregar os produtos.')
    products.push(...(data || []))
    if (!data || data.length < 100) break
  }
  return { categories: (categories.data || []) as Category[], products }
}
