import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const PERCENTUAL = 1.0

// Cron job executado automaticamente todo dia 05 as 9h (Vercel Cron)
// Gera comissao de 1% sobre o faturamento do mes ANTERIOR para cada tenant ativo
// Tambem pode ser chamado manualmente pelo admin
export async function GET(request: Request) {
  try {
    // Validacao simples de seguranca para evitar acesso nao autorizado
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'we-delivery-cron-secret-2026'

    if (authHeader !== `Bearer ${cronSecret}`) {
      // Permitir chamada sem auth apenas em desenvolvimento
      if (process.env.NODE_ENV === 'production' && authHeader) {
        return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
      }
    }

    const admin = getAdminClient()
    const now = new Date()

    // Mes anterior
    const mesAnterior = now.getMonth() === 0 ? 12 : now.getMonth()
    const anoAnterior = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const primeiroDia = new Date(anoAnterior, mesAnterior - 1, 1).toISOString()
    const ultimoDia = new Date(anoAnterior, mesAnterior, 0, 23, 59, 59).toISOString()

    console.log(`Gerando comissoes para ${mesAnterior}/${anoAnterior}`)

    // Buscar tenants ativos
    const { data: tenants } = await admin
      .from('tenants')
      .select('id, nome, status')
      .eq('status', 'active')

    if (!tenants || tenants.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum tenant ativo encontrado',
        geradas: 0,
        comissoes: []
      })
    }

    // Buscar pedidos do mes anterior
    const tenantIds = tenants.map(t => t.id)
    const { data: pedidos } = await admin
      .from('pedidos')
      .select('tenant_id, valor_total, status, pago, forma_pagamento')
      .in('tenant_id', tenantIds)
      .gte('data_criacao', primeiroDia)
      .lte('data_criacao', ultimoDia)
      .neq('status', 'cancelado')

    // Calcular faturamento por tenant
    const faturamentoPorTenant: Record<string, number> = {}
    tenantIds.forEach(id => { faturamentoPorTenant[id] = 0 })

    pedidos?.forEach(p => {
      const ehPago = p.pago === true
      const ehEntregueDinheiro = p.status === 'entregue' && p.forma_pagamento === 'dinheiro'
      if (ehPago || ehEntregueDinheiro) {
        faturamentoPorTenant[p.tenant_id] += Number(p.valor_total)
      }
    })

    const comissoesGeradas = []

    for (const tenant of tenants) {
      const fat = faturamentoPorTenant[tenant.id] || 0
      const valorComissao = Math.round(fat * (PERCENTUAL / 100) * 100) / 100

      // Verificar se ja existe comissao para este mes/ano
      const { data: existente } = await admin
        .from('comissoes_mensais')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('mes', mesAnterior)
        .eq('ano', anoAnterior)
        .single()

      if (existente) {
        console.log(`Comissao ja existe para ${tenant.nome} em ${mesAnterior}/${anoAnterior}`)
        continue
      }

      // Inserir comissao
      const { data: novaComissao, error } = await admin
        .from('comissoes_mensais')
        .insert({
          tenant_id: tenant.id,
          mes: mesAnterior,
          ano: anoAnterior,
          faturamento_total: fat,
          percentual: PERCENTUAL,
          valor_comissao: valorComissao,
          data_geracao: new Date().toISOString().split('T')[0],
          status: 'pendente'
        })
        .select()
        .single()

      if (error) {
        console.error(`Erro ao criar comissao para ${tenant.nome}:`, error)
        continue
      }

      // Atualizar status_pagamento do tenant
      await admin
        .from('tenants')
        .update({ status_pagamento: 'pendente' })
        .eq('id', tenant.id)

      comissoesGeradas.push({
        tenant: tenant.nome,
        faturamento: fat,
        comissao: valorComissao,
        id: novaComissao.id
      })
    }

    return NextResponse.json({
      success: true,
      message: `${comissoesGeradas.length} comissões geradas para ${mesAnterior}/${anoAnterior}`,
      periodo: `${mesAnterior}/${anoAnterior}`,
      geradas: comissoesGeradas.length,
      comissoes: comissoesGeradas
    })

  } catch (error) {
    console.error('cron_gerar_comissoes_error:', error)
    return NextResponse.json({ error: 'Erro ao gerar comissões' }, { status: 500 })
  }
}

// Tambem aceita POST para compatibilidade com Vercel Cron
export async function POST(request: Request) {
  return GET(request)
}
