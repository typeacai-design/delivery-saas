import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { authenticatedTenant, SALES_ROLES } from '@/lib/tenant-auth'

export async function PATCH(request: Request) {
  try {
    // Obter tenantId via cookie/session
    const { tenantId } = await authenticatedTenant(SALES_ROLES)
    if (!tenantId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { pedido_id, status, motivo_cancelamento, motivo_cancelamento_detalhe } = await request.json()

    if (!pedido_id || !status) {
      return NextResponse.json({ error: 'pedido_id e status são obrigatórios' }, { status: 400 })
    }

    // Validar status
    const statusValidos = ['novo', 'preparando', 'pronto', 'saiu', 'entregue', 'cancelado']
    if (!statusValidos.includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }

    // Criar cliente admin para bypassar RLS
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar se o pedido pertence ao tenant
    const { data: pedido, error: fetchError } = await admin
      .from('pedidos')
      .select('id, codigo, tenant_id, status')
      .eq('id', pedido_id)
      .eq('tenant_id', tenantId) // Só busca se pertencer ao tenant
      .single()

    if (fetchError || !pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    // Preparar updates
    const updates: Record<string, any> = {
      status,
      data_atualizacao: new Date().toISOString(),
    }

    // Se for cancelamento
    if (status === 'cancelado') {
      updates.motivo_cancelamento = motivo_cancelamento || null
      updates.motivo_cancelamento_detalhe = motivo_cancelamento_detalhe || null
      updates.cancelado_por = 'lojista'
      updates.cancelado_em = new Date().toISOString()
    }

    // Se for entrega
    if (status === 'entregue') {
      updates.entregue_em = new Date().toISOString()
    }

    // Atualizar status com admin client (bypassa RLS)
    const { error: updateError } = await admin
      .from('pedidos')
      .update(updates)
      .eq('id', pedido_id)
      .eq('tenant_id', tenantId)

    if (updateError) {
      console.error('Erro ao atualizar status:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar status: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, status })

  } catch (error: any) {
    console.error('update_status_error:', error)
    return NextResponse.json({ error: 'Erro interno: ' + (error.message || 'Desconhecido') }, { status: 500 })
  }
}
