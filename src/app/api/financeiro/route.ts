import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'

const PAGE = 1000

async function allRows<T>(queryFor: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await queryFor(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE) return rows
  }
}

export async function GET() {
  try {
    const { supabase, tenantId } = await authenticatedTenant(['owner'])
    if (!tenantId) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const [orders, expenses, transactions, tenant] = await Promise.all([
      // Pedidos com código
      allRows((from, to) => supabase.from('pedidos').select('id,codigo,created_at,valor_total,taxa_entrega,forma_pagamento,status,pago,pago_em').eq('tenant_id', tenantId).order('created_at', { ascending: false }).range(from, to)),
      // Despesas
      allRows((from, to) => supabase.from('despesas').select('id,nome,valor,dia_vencimento,recorrencia,created_at,pago').eq('tenant_id', tenantId).order('created_at', { ascending: false }).range(from, to)),
      // Transações manuais
      allRows((from, to) => supabase.from('movimentacoes_financeiras').select('id,tipo,descricao,valor,data,categoria').eq('tenant_id', tenantId).order('data', { ascending: false }).range(from, to)),
      supabase.from('tenants').select('id,config').eq('id', tenantId).single(),
    ])

    if (tenant.error) throw tenant.error
    return NextResponse.json({ orders, expenses, transactions, tenant: tenant.data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('financeiro_read_failed', error)
    return NextResponse.json({ error: 'Não foi possível carregar os dados financeiros' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const { supabase, tenantId } = await authenticatedTenant(['owner', 'manager', 'attendant'])
  if (!tenantId) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await request.json()
  const allowed = ['dinheiro','pix','cartao_credito','cartao_debito']
  // IMPORTANTE: preservar o valor EXATO enviado (true/false), nao so true
  const formas = Object.fromEntries(allowed.map(key => [key, body.formas?.[key] === true]))

  const { data: tenant } = await supabase.from('tenants').select('config').eq('id', tenantId).single()
  if (!tenant) return NextResponse.json({ error: 'Não foi possível salvar' }, { status: 500 })

  const config = { ...((tenant.config || {}) as Record<string, unknown>), formas_pagamento_aceitas: formas }
  const { error } = await supabase.from('tenants').update({ config }).eq('id', tenantId)

  if (error) {
    console.error('Erro ao salvar formas pagamento:', error)
    return NextResponse.json({ error: 'Não foi possível salvar: ' + error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, config })
}
