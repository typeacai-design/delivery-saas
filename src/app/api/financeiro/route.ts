import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'
import { createClient } from '@supabase/supabase-js'

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

// Cliente com service_role para BURLAR RLS — a autenticação já foi feita
// acima via authenticatedTenant (validamos que o usuário tem acesso ao tenant)
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET() {
  try {
    // 1) Autentica o usuário e descobre o tenant dele
    const { tenantId } = await authenticatedTenant(['owner', 'manager', 'attendant'])
    if (!tenantId) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    // 2) Usa service_role para buscar os dados (bypassa RLS)
    const admin = adminClient()

    const [orders, expenses, transactions, tenant] = await Promise.all([
      // Pedidos com código
      allRows((from, to) => admin.from('pedidos').select('id,codigo,created_at,valor_total,taxa_entrega,forma_pagamento,status,pago,pago_em').eq('tenant_id', tenantId).order('created_at', { ascending: false }).range(from, to)),
      // Despesas (não tem coluna `pago`)
      allRows((from, to) => admin.from('despesas').select('id,nome,valor,dia_vencimento,recorrencia,created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).range(from, to)),
      // Transações manuais (com categoria)
      allRows((from, to) => admin.from('movimentacoes_financeiras').select('id,tipo,descricao,valor,data,categoria,forma_pagamento').eq('tenant_id', tenantId).order('data', { ascending: false }).range(from, to)),
      admin.from('tenants').select('id,config').eq('id', tenantId).single(),
    ])

    if (tenant.error) throw tenant.error

    return NextResponse.json({ orders, expenses, transactions, tenant: tenant.data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('financeiro_read_failed', error)
    return NextResponse.json({ error: 'Não foi possível carregar os dados financeiros' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Owner, manager e attendant podem lançar transações
    const { tenantId } = await authenticatedTenant(['owner', 'manager', 'attendant'])
    if (!tenantId) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const body = await request.json()
    const { tipo, categoria, descricao, valor, data } = body

    // Validações
    if (!tipo || !['entrada', 'saida'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo inválido. Use "entrada" ou "saida".' }, { status: 400 })
    }
    const categoriasValidas = ['pedido', 'despesa', 'manual', 'recebimento', 'fornecedor']
    if (!categoria || !categoriasValidas.includes(categoria)) {
      return NextResponse.json({ error: `Categoria inválida. Use uma de: ${categoriasValidas.join(', ')}.` }, { status: 400 })
    }
    const valorNum = Number(valor)
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return NextResponse.json({ error: 'Valor deve ser um número positivo.' }, { status: 400 })
    }
    if (!descricao || typeof descricao !== 'string' || !descricao.trim()) {
      return NextResponse.json({ error: 'Descrição é obrigatória.' }, { status: 400 })
    }
    const dataFinal = data || new Date().toISOString().split('T')[0]

    // Usar service_role para BURLAR RLS — autenticação já foi validada acima
    const admin = adminClient()
    const { data: novaMov, error } = await admin
      .from('movimentacoes_financeiras')
      .insert({
        tenant_id: tenantId,
        tipo,
        categoria,
        descricao: descricao.trim().slice(0, 500),
        valor: valorNum,
        data: dataFinal,
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao inserir movimentação:', error)
      return NextResponse.json({ error: 'Não foi possível salvar a transação: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, movimentacao: novaMov }, { status: 201 })
  } catch (error: any) {
    console.error('financeiro_create_failed:', error)
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 })
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

  // Re-ler o tenant do banco para devolver o estado canônico ao cliente
  const { data: updatedTenant } = await supabase
    .from('tenants')
    .select('id, config')
    .eq('id', tenantId)
    .single()

  return NextResponse.json({ success: true, tenant: updatedTenant })
}
