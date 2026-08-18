import { ALL_TENANT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'
import { NextResponse } from 'next/server'

interface PedidoComDados {
  id: string
  cliente_nome?: string
  cliente_telefone?: string
  valor_total: number
  taxa_entrega?: number
  forma_pagamento?: string[]
  observacoes?: string
  itens?: { nome: string; quantidade: number; valor_unitario: number }[]
  produtos?: { nome: string; quantidade: number; valor: number }[]
  tempo_preparo?: number
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `55${digits}`
  if (digits.length === 10) return `55${digits.slice(0, 2)}${digits.slice(2)}`
  if (digits.startsWith('55')) return digits
  return `55${digits}`
}

function gerarMensagemPedido(pedido: PedidoComDados, loja: any): string {
  const tipoPgto = (pedido.forma_pagamento || []).map((f: string) => {
    const map: Record<string, string> = {
      dinheiro: '💵 Dinheiro',
      pix: '🔑 PIX',
      cartao_credito: '💳 Crédito',
      cartao_debito: '💳 Débito',
      vale_refeicao: '🍽️ Vale Refeição',
    }
    return map[f] || f
  }).join(', ')

  const valorPago = (pedido as any).valor_pago?.[0]
  const troco = (pedido as any).troco

  const itens = (pedido.itens || pedido.produtos || []).map((item: any) => {
    const qtd = item.quantidade
    const nome = item.nome
    const valor = item.valor_unitario || item.valor
    return `${qtd}x ${nome} — R$ ${Number(valor * qtd).toFixed(2).replace('.', ',')}`
  })

  const linhas: string[] = []

  linhas.push(`🍔 *PEDIDO #${pedido.id.split('-')[0].toUpperCase()}*`)
  linhas.push('')
  linhas.push(`👤 Cliente: *${pedido.cliente_nome || 'Não informado'}*`)
  if (pedido.observacoes) linhas.push(`📝 Obs: ${pedido.observacoes}`)
  linhas.push('')
  linhas.push('📋 *Itens:*')
  itens.forEach(item => linhas.push(`  ${item}`))
  linhas.push('')
  linhas.push(`💰 *Total: R$ ${Number(pedido.valor_total).toFixed(2).replace('.', ',')}*`)
  if (pedido.taxa_entrega) linhas.push(`   (Taxa entrega: R$ ${Number(pedido.taxa_entrega).toFixed(2).replace('.', ',')})`)
  linhas.push(`💳 Pagamento: ${tipoPgto}`)
  if (valorPago && valorPago > pedido.valor_total) {
    linhas.push(`💵 Troco para: R$ ${Number(valorPago).toFixed(2).replace('.', ',')} (troco: R$ ${Number(troco).toFixed(2).replace('.', ',')})`)
  }
  if (pedido.tempo_preparo) {
    linhas.push('')
    linhas.push(`⏱️ *Pronto em ~${pedido.tempo_preparo} minutos*`)
  }
  linhas.push('')
  linhas.push(`_${loja?.nome || 'Sua loja'}_`)

  return linhas.join('\n')
}

export async function POST(request: Request) {
  const auth = await authenticatedTenant(ALL_TENANT_ROLES)
  const { supabase, tenantId } = auth
  const authStatus = tenantAuthStatus(auth)
  if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

  try {
    const body = await request.json()
    const { pedido_id } = body

    if (!pedido_id) {
      return NextResponse.json({ error: 'pedido_id obrigatório' }, { status: 400 })
    }

    // Buscar pedido completo
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('*, clientes(nome, telefone)')
      .eq('id', pedido_id)
      .eq('tenant_id', tenantId)
      .single()

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    // Buscar itens
    const { data: itens } = await supabase
      .from('pedido_itens')
      .select('nome, quantidade, valor_unitario')
      .eq('pedido_id', pedido_id)

    // Buscar tenant (loja)
    const { data: tenant } = await supabase
      .from('tenants')
      .select('nome, whatsapp')
      .eq('id', tenantId)
      .single()

    const pedidoCompleto: PedidoComDados = {
      ...pedido,
      cliente_nome: pedido.clientes?.nome,
      cliente_telefone: pedido.clientes?.telefone,
      itens: itens || [],
      produtos: itens?.map(i => ({ nome: i.nome, quantidade: i.quantidade, valor: i.valor_unitario })) || [],
    }

    // Gerar mensagem
    const mensagem = gerarMensagemPedido(pedidoCompleto, tenant)
    const telefone = formatPhone(pedido.clientes?.telefone || '')

    // Gerar link WhatsApp (wa.me)
    // Se tiver telefone, abre conversa diretamente. Se não, só texto.
    let whatsappUrl = ''
    if (telefone.length >= 12) {
      whatsappUrl = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`
    } else {
      // Copiar para área de transferência
      whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensagem)}`
    }

    return NextResponse.json({
      mensagem,
      whatsapp_url: whatsappUrl,
      telefone: telefone || null,
      tem_telefone: !!telefone,
    })
  } catch (error: any) {
    console.error('Erro WhatsApp:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
