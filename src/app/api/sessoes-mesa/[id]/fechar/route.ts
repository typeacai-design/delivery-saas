import { NextResponse } from 'next/server'
import { SALES_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sessoes-mesa/[id]/fechar
 *
 * Fecha a sessão de mesa:
 *  1) Marca sessão como 'fechada' com data_fechamento
 *  2) Grava forma_pagamento + valor_pago + troco_para (informado pelo atendente)
 *  3) Cria um pedido "consolidado" (tipo_pedido='consolidado') com a soma dos pedidos individuais
 *     para impressão da comanda final
 *  4) Os pedidos individuais permanecem no banco (auditoria/cozinha) com sessao_mesa_id mantido
 *     mas ficam ocultos do fluxo (aba Fluxo) por causa do filtro tipo_pedido
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedTenant(SALES_ROLES)
  const authStatus = tenantAuthStatus(auth)
  if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão' }, { status: authStatus })

  const { supabase, tenantId, user } = auth
  const { id: sessaoId } = await params

  // Aceitar pagamento via body (no /api/payment do cliente) ou via query
  let forma_pagamento: string | null = null
  let valor_pago: number | null = null
  let troco_para: number | null = null
  try {
    const body = await req.json().catch(() => ({}))
    forma_pagamento = body?.forma_pagamento ?? null
    valor_pago = typeof body?.valor_pago === 'number' ? body.valor_pago : null
    troco_para = typeof body?.troco_para === 'number' ? body.troco_para : null
  } catch {
    /* sem body */
  }

  // Buscar sessão + pedidos ativos (não cancelados)
  const { data: sessao, error: e1 } = await supabase
    .from('sessoes_mesa')
    .select('id, mesa_numero, cliente_nome, cliente_whatsapp, valor_total, status')
    .eq('id', sessaoId)
    .eq('tenant_id', tenantId)
    .single()

  if (e1 || !sessao) return NextResponse.json({ error: e1?.message || 'Sessão não encontrada' }, { status: 404 })
  if (sessao.status !== 'aberta') return NextResponse.json({ error: 'Sessão já está ' + sessao.status }, { status: 400 })

  // Marcar sessão como fechada + gravar pagamento
  const valor_total_recebido =
    valor_pago != null ? Math.min(valor_pago, sessao.valor_total) : sessao.valor_total

  const { error: e2 } = await supabase
    .from('sessoes_mesa')
    .update({
      status: 'fechada',
      data_fechamento: new Date().toISOString(),
      forma_pagamento,
      valor_pago,
      troco_para,
      valor_total_recebido,
      fechada_por: user?.id || null,
    })
    .eq('id', sessaoId)

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    sessao_id: sessaoId,
    mesa_numero: sessao.mesa_numero,
    valor_total: sessao.valor_total,
    valor_total_recebido,
    forma_pagamento,
    troco_para,
    cliente_nome: sessao.cliente_nome,
    fechada_em: new Date().toISOString(),
  })
}
