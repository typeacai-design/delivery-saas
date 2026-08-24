import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const PERCENTUAL = 1.0 // 1% do faturamento

// GET: Buscar faturamento por tenant (TEMPO REAL)
// Calcula do primeiro dia do mes atual ate hoje
export async function GET(request: Request) {
  try {
    const admin = getAdminClient()
    const now = new Date()

    // Primeiro dia do mes atual
    const primeiroDiaMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const hoje = now.toISOString()

    // Proxima cobranca: dia 05 do proximo mes
    const proximaCobranca = new Date(now.getFullYear(), now.getMonth() + 1, 5)
    const diasAteCobranca = Math.ceil((proximaCobranca.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Buscar todos tenants ativos
    const { data: tenants } = await admin
      .from('tenants')
      .select('id, nome, slug, email, status, status_pagamento')
      .eq('status', 'active')

    if (!tenants) return NextResponse.json({
      data_referencia: now.toISOString(),
      dias_ate_cobranca: diasAteCobranca,
      data_proxima_cobranca: proximaCobranca.toISOString().split('T')[0],
      tenants: [],
      totais: { faturamento_total: 0, previsao_comissao_total: 0 }
    })

    const tenantIds = tenants.map(t => t.id)

    // Buscar pedidos do mes atual
    const { data: pedidos } = await admin
      .from('pedidos')
      .select('tenant_id, valor_total, data_criacao, status, pago, forma_pagamento')
      .in('tenant_id', tenantIds)
      .gte('data_criacao', primeiroDiaMes)
      .neq('status', 'cancelado')

    // Calcular faturamento por tenant
    const faturamentoPorTenant: Record<string, { total: number; pedidos: number }> = {}
    tenantIds.forEach(id => {
      faturamentoPorTenant[id] = { total: 0, pedidos: 0 }
    })

    pedidos?.forEach(p => {
      // Conta como faturamento: pago=true ou (entregue E dinheiro)
      const ehPago = p.pago === true
      const ehEntregueDinheiro = p.status === 'entregue' && p.forma_pagamento === 'dinheiro'
      if (ehPago || ehEntregueDinheiro) {
        faturamentoPorTenant[p.tenant_id] = {
          total: faturamentoPorTenant[p.tenant_id].total + Number(p.valor_total),
          pedidos: faturamentoPorTenant[p.tenant_id].pedidos + 1,
        }
      }
    })

    // Montar resultado
    let faturamentoTotalGeral = 0
    let previsaoTotalGeral = 0

    const result = tenants.map(t => {
      const fat = faturamentoPorTenant[t.id]?.total || 0
      const previsao = Math.round(fat * (PERCENTUAL / 100) * 100) / 100
      faturamentoTotalGeral += fat
      previsaoTotalGeral += previsao

      return {
        id: t.id,
        nome: t.nome,
        slug: t.slug,
        email: t.email,
        status: t.status,
        status_pagamento: t.status_pagamento,
        total_faturamento: fat,
        comissao_1_percent: previsao,
        previsao_comissao: previsao,
        total_pedidos: faturamentoPorTenant[t.id]?.pedidos || 0,
      }
    })

    // Filtrar apenas os que tem faturamento > 0
    const comFaturamento = result.filter(t => t.total_faturamento > 0)

    return NextResponse.json({
      data_referencia: now.toISOString(),
      dias_ate_cobranca: diasAteCobranca,
      data_proxima_cobranca: proximaCobranca.toISOString().split('T')[0],
      tenants: comFaturamento,
      totais: {
        faturamento_total: faturamentoTotalGeral,
        previsao_comissao_total: Math.round(previsaoTotalGeral * 100) / 100
      }
    })

  } catch (error) {
    console.error('faturamento_get_error', error)
    return NextResponse.json({ error: 'Erro ao buscar faturamento' }, { status: 500 })
  }
}

// PUT: Marcar/demarcar como pago (comissao)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { tenant_id, pago, comissao_id } = body

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id obrigatório' }, { status: 400 })
    }

    const admin = getAdminClient()
    const statusPagamento = pago ? 'pago' : 'pendente'

    // Atualizar status de pagamento do tenant
    const { error } = await admin
      .from('tenants')
      .update({ status_pagamento: statusPagamento })
      .eq('id', tenant_id)

    if (error) throw error

    // Se comissao_id fornecido, atualizar a comissao
    if (comissao_id) {
      await admin
        .from('comissoes_mensais')
        .update({
          status: statusPagamento,
          data_pagamento: pago ? new Date().toISOString().split('T')[0] : null
        })
        .eq('id', comissao_id)
    }

    return NextResponse.json({ success: true, status_pagamento: statusPagamento })

  } catch (error) {
    console.error('faturamento_put_error', error)
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}
