import { NextResponse } from 'next/server'
import { ALL_TENANT_ROLES, SALES_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

// GET - listar pedidos do tenant
export async function GET() {
  try {
    const auth = await authenticatedTenant(ALL_TENANT_ROLES)
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    const { data: pedidos, error } = await supabase
      .from('pedidos')
      .select(`
        *,
        cliente:clientes(nome, telefone)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Contar pedidos por cliente (para mostrar "Xº pedido")
    const pedidosComContagem = await Promise.all(
      (pedidos || []).map(async (pedido) => {
        if (!pedido.cliente_whatsapp && !pedido.cliente_telefone) {
          return { ...pedido, contagem_pedidos: null }
        }

        const telefone = pedido.cliente_whatsapp || pedido.cliente_telefone

        // Contar quantos pedidos este cliente já fez (incluindo este)
        const { count } = await supabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('cliente_whatsapp', telefone)

        return { ...pedido, contagem_pedidos: count || 1 }
      })
    )

    const pedidosSeguros = pedidosComContagem.map(({ avaliacao_token_hash, ...pedido }) => { void avaliacao_token_hash; return pedido })
    return NextResponse.json({ pedidos: pedidosSeguros })
  } catch (error: any) {
    console.error('Erro ao buscar pedidos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - criar novo pedido
export async function POST(request: Request) {
  try {
    const auth = await authenticatedTenant(SALES_ROLES)
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    const body = await request.json()

    const {
      cliente_id,
      cliente_nome,
      cliente_whatsapp,
      itens,
      valor_subtotal,
      taxa_entrega,
      valor_desconto,
      valor_total,
      forma_pagamento,
      troco_para,
      bairro_entrega,
      taxa_bairro,
      observacoes,
      cupom_aplicado,
      tempo_estimado_min,
    } = body

    if (!itens || itens.length === 0) {
      return NextResponse.json({ error: 'Pedido sem itens' }, { status: 400 })
    }

    // Verificar valor mínimo do pedido
    const { data: config } = await supabase
      .from('tenants')
      .select('config')
      .eq('id', tenantId)
      .single()

    const tenantConfig = config?.config || {}
    const valorMinimo = tenantConfig.valor_minimo_pedido || 0

    if (valorMinimo > 0 && valor_subtotal < valorMinimo) {
      return NextResponse.json({
        error: `Pedido mínimo de R$ ${valorMinimo.toFixed(2).replace('.', ',')}`
      }, { status: 400 })
    }

    // Contar pedidos do cliente para identificar "Xº pedido"
    let contagemPedidos = null
    if (cliente_whatsapp) {
      const telefoneLimpo = cliente_whatsapp.replace(/\D/g, '')
      const { count } = await supabase
        .from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('cliente_whatsapp', telefoneLimpo)

      contagemPedidos = (count || 0) + 1
    }

    // Criar o pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        tenant_id: tenantId,
        cliente_id: cliente_id || null,
        cliente_nome: cliente_nome || 'Cliente',
        cliente_whatsapp: cliente_whatsapp?.replace(/\D/g, '') || null,
        valor_subtotal: valor_subtotal || 0,
        taxa_entrega: taxa_entrega || 0,
        valor_desconto: valor_desconto || 0,
        valor_total: valor_total || 0,
        forma_pagamento: forma_pagamento || 'dinheiro',
        troco_para: troco_para || null,
        bairro_entrega: bairro_entrega || null,
        taxa_bairro: taxa_bairro || 0,
        observacoes: observacoes || null,
        status: 'novo',
        tempo_estimado_min: tempo_estimado_min || null,
      })
      .select()
      .single()

    if (pedidoError) throw pedidoError

    // Inserir itens do pedido
    const itensParaInserir = itens.map((item: any) => ({
      pedido_id: pedido.id,
      produto_id: item.produto_id,
      nome: item.nome,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      variante_id: item.variante_id || null,
      variante_nome: item.variante_nome || null,
      complementos: item.complementos || [],
      observacao: item.observacao || null,
    }))

    const { error: itensError } = await supabase
      .from('pedido_itens')
      .insert(itensParaInserir)

    if (itensError) {
      // Rollback: deletar pedido criado
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      throw itensError
    }

    // Atualizar uso do cupom se aplicou
    if (cupom_aplicado) {
      try {
        await supabase.rpc('incrementar_usos_cupom', {
          p_tenant_id: tenantId,
          p_codigo: cupom_aplicado,
        })
      } catch {
        // Ignora erro de cupom - não bloqueia o pedido
      }
    }

    // Baixar estoque de matéria-prima conforme ingredientes vinculados
    try {
      const produtoIds = itens
        .map((i: any) => i.produto_id)
        .filter(Boolean)

      if (produtoIds.length > 0) {
        const { data: vinculos } = await supabase
          .from('produto_ingredientes')
          .select('produto_id, insumo_id, quantidade')
          .in('produto_id', produtoIds)
          .eq('tenant_id', tenantId)

        if (vinculos && vinculos.length > 0) {
          // Acumular baixa por insumo
          const baixas: Record<string, number> = {}
          for (const item of itens) {
            if (!item.produto_id) continue
            const qtdItem = Number(item.quantidade) || 1
            for (const v of vinculos) {
              if (v.produto_id === item.produto_id) {
                const k = v.insumo_id
                const consumo = Number(v.quantidade) * qtdItem
                baixas[k] = (baixas[k] || 0) + consumo
              }
            }
          }

          for (const [insumoId, delta] of Object.entries(baixas)) {
            const { data: atual } = await supabase
              .from('insumos')
              .select('quantidade_atual')
              .eq('id', insumoId)
              .single()
            if (!atual) continue
            const novaQtd = Math.max(0, Number(atual.quantidade_atual) - delta)
            await supabase
              .from('insumos')
              .update({ quantidade_atual: novaQtd })
              .eq('id', insumoId)
            await supabase.from('movimentacoes_estoque').insert({
              insumo_id: insumoId,
              tipo: 'saida',
              quantidade: delta,
              observacao: `Pedido ${pedido.id?.slice(0, 8) || ''}`,
            })
          }
        }
      }
    } catch (e) {
      // Não bloqueia o pedido se falhar a baixa
      console.error('Erro ao baixar matéria-prima:', e)
    }

    return NextResponse.json({
      ...pedido,
      contagem_pedidos: contagemPedidos,
      itens: itensParaInserir,
    })
  } catch (error: any) {
    console.error('Erro ao criar pedido:', error)
    return NextResponse.json({ error: error.message || 'Erro ao criar pedido' }, { status: 500 })
  }
}

// PUT - atualizar status do pedido
export async function PUT(request: Request) {
  try {
    const auth = await authenticatedTenant(ALL_TENANT_ROLES)
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    const body = await request.json()
    const { id, status, observacoes } = body

    if (!id) {
      return NextResponse.json({ error: 'ID do pedido é obrigatório' }, { status: 400 })
    }

    const updates: any = {}
    if (status) updates.status = status
    if (observacoes !== undefined) updates.observacoes = observacoes
    updates.updated_at = new Date().toISOString()

    const { data: pedido, error } = await supabase
      .from('pedidos')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(pedido)
  } catch (error: any) {
    console.error('Erro ao atualizar pedido:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
