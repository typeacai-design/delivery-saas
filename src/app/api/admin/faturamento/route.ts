import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET: Buscar faturamento por tenant
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const inicio = searchParams.get('inicio')
  const fim = searchParams.get('fim')

  try {
    const admin = getAdminClient()

    // Buscar todos tenants ativos
    const { data: tenants } = await admin
      .from('tenants')
      .select('id, nome, slug, email, status, status_pagamento')
      .eq('status', 'active')

    if (!tenants) return NextResponse.json({ tenants: [] })

    // Para cada tenant, buscar faturamento do período
    const tenantIds = tenants.map(t => t.id)
    const inicioDate = inicio ? `${inicio}T00:00:00` : '1970-01-01T00:00:00'
    const fimDate = fim ? `${fim}T23:59:59` : new Date().toISOString()

    const { data: pedidos } = await admin
      .from('pedidos')
      .select('tenant_id, valor_total, data_criacao, status')
      .in('tenant_id', tenantIds)
      .gte('data_criacao', inicioDate)
      .lte('data_criacao', fimDate)
      .neq('status', 'cancelado')

    // Calcular faturamento por tenant (apenas pedidos pagos ou entregue com dinheiro)
    const faturamentoPorTenant: Record<string, { total: number; pedidos: number }> = {}
    tenantIds.forEach(id => {
      faturamentoPorTenant[id] = { total: 0, pedidos: 0 }
    })

    pedidos?.forEach(p => {
      // Conta como faturamento: pago=true ou (entregue E dinheiro)
      if (p.status !== 'cancelado') {
        faturamentoPorTenant[p.tenant_id] = {
          total: faturamentoPorTenant[p.tenant_id].total + Number(p.valor_total),
          pedidos: faturamentoPorTenant[p.tenant_id].pedidos + 1,
        }
      }
    })

    // Montar resultado
    const result = tenants.map(t => ({
      id: t.id,
      nome: t.nome,
      slug: t.slug,
      email: t.email,
      status: t.status,
      status_pagamento: t.status_pagamento,
      total_faturamento: faturamentoPorTenant[t.id]?.total || 0,
      comissao_1_percent: Math.round((faturamentoPorTenant[t.id]?.total || 0) * 100) / 100,
      total_pedidos: faturamentoPorTenant[t.id]?.pedidos || 0,
      ultimo_pedido: null,
    }))

    // Filtrar apenas os que tem faturamento > 0
    const comFaturamento = result.filter(t => t.total_faturamento > 0)

    return NextResponse.json({ tenants: comFaturamento })

  } catch (error) {
    console.error('faturamento_get_error', error)
    return NextResponse.json({ error: 'Erro ao buscar faturamento' }, { status: 500 })
  }
}

// PUT: Marcar/demarcar como pago
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { tenant_id, pago } = body

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id obrigatório' }, { status: 400 })
    }

    const admin = getAdminClient()
    const statusPagamento = pago ? 'pago' : 'pendente'

    const { error } = await admin
      .from('tenants')
      .update({ status_pagamento: statusPagamento })
      .eq('id', tenant_id)

    if (error) throw error

    return NextResponse.json({ success: true, status_pagamento: statusPagamento })

  } catch (error) {
    console.error('faturamento_put_error', error)
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}
