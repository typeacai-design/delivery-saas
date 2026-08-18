/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'

// POST /api/mensalidades/gerar
// Gera mensalidades retroativas e a do mês atual, idempotente.
// Não duplica: usa UNIQUE (tenant_id, mes, ano) — se já existir, mantém.

export async function POST() {
  const { supabase, user, tenantId, forbidden } = await authenticatedTenant(['owner', 'manager'])
  if (!user || !tenantId) return NextResponse.json({ error: forbidden ? 'Sem permissao' : 'Nao autenticado' }, { status: forbidden ? 403 : 401 })
  const tid = tenantId

  const { data: tenant } = await supabase
    .from('tenants')
    .select('created_at, valor_mensalidade')
    .eq('id', tid)
    .single()

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
  }

  const valor = Number(tenant.valor_mensalidade) || 99.90
  const inicio = new Date(tenant.created_at)
  const hoje = new Date()

  // Garante mensalidade pra cada mês entre a criação e hoje
  const rows: any[] = []
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1)
  while (cursor <= new Date(hoje.getFullYear(), hoje.getMonth(), 1)) {
    rows.push({
      tenant_id: tid,
      mes: cursor.getMonth() + 1,
      ano: cursor.getFullYear(),
      valor,
      data_vencimento: new Date(cursor.getFullYear(), cursor.getMonth(), 10).toISOString().slice(0, 10),
      status: 'pendente',
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  if (rows.length === 0) {
    return NextResponse.json({ success: true, created: 0 })
  }

  const { error } = await supabase
    .from('mensalidades')
    .upsert(rows, { onConflict: 'tenant_id,mes,ano', ignoreDuplicates: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
