import { NextResponse } from 'next/server'
import { MANAGEMENT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sessoes-mesa/[id]/fechar
 *
 * Fecha a sessão de mesa:
 *  1) Marca sessão como 'fechada' com data_fechamento
 *  2) Cria um pedido "consolidado" (tipo_pedido='consolidado') com a soma dos pedidos individuais
 *     para impressão da comanda final
 *  3) Os pedidos individuais permanecem no banco (auditoria/cozinha) com sessao_mesa_id mantido
 *     mas ficam ocultos do fluxo (aba Fluxo) por causa do filtro tipo_pedido
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const authStatus = tenantAuthStatus(auth)
  if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão' }, { status: authStatus })

  const { supabase, tenantId } = auth
  const { id: sessaoId } = await params

  // Buscar sessão + pedidos ativos (não cancelados)
  const { data: sessao, error: e1 } = await supabase
    .from('sessoes_mesa')
    .select('id, mesa_numero, cliente_nome, cliente_whatsapp, valor_total, status')
    .eq('id', sessaoId)
    .eq('tenant_id', tenantId)
    .single()

  if (e1 || !sessao) return NextResponse.json({ error: e1?.message || 'Sessão não encontrada' }, { status: 404 })
  if (sessao.status !== 'aberta') return NextResponse.json({ error: 'Sessão já está ' + sessao.status }, { status: 400 })

  // Marcar sessão como fechada
  const { error: e2 } = await supabase
    .from('sessoes_mesa')
    .update({ status: 'fechada', data_fechamento: new Date().toISOString() })
    .eq('id', sessaoId)

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    sessao_id: sessaoId,
    mesa_numero: sessao.mesa_numero,
    valor_total: sessao.valor_total,
    cliente_nome: sessao.cliente_nome,
    fechada_em: new Date().toISOString(),
  })
}
