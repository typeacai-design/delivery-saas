import { MANAGEMENT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'
import { adminEquipe, respostaEquipe } from '@/lib/equipe-server'
import { ehEntrega } from '@/lib/entregas'

/** Lojista escolhe (ou tira) o motoboy de uma entrega. O motoboy escolhido é avisado pelo banco. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const status = tenantAuthStatus(auth)
  if (status) return respostaEquipe({ error: 'Sem permissão' }, status)
  const { id } = await params
  const body = await request.json().catch(() => null) as { entregador_id?: unknown } | null
  const entregadorId = typeof body?.entregador_id === 'string' && body.entregador_id ? body.entregador_id : null
  const admin = adminEquipe()
  const { data: pedido } = await admin.from('pedidos').select('id, status, tipo_pedido, tipo_entrega, sessao_mesa_id').eq('id', id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (!pedido) return respostaEquipe({ error: 'Pedido não encontrado' }, 404)
  if (!ehEntrega(pedido)) return respostaEquipe({ error: 'Só pedidos de entrega têm motoboy' }, 400)
  if (pedido.status === 'entregue' || pedido.status === 'cancelado') return respostaEquipe({ error: 'Pedido já finalizado' }, 409)
  if (entregadorId) {
    const { data: motoboy } = await admin.from('usuarios_loja').select('id').eq('tenant_id', auth.tenantId).eq('user_id', entregadorId).eq('role', 'motoboy').eq('ativo', true).maybeSingle()
    if (!motoboy) return respostaEquipe({ error: 'Motoboy não encontrado na sua equipe' }, 400)
  }
  const { error } = await admin.from('pedidos').update({ entregador_id: entregadorId, entregador_em: entregadorId ? new Date().toISOString() : null }).eq('id', id).eq('tenant_id', auth.tenantId)
  if (error) return respostaEquipe({ error: 'Não foi possível salvar' }, 500)
  return respostaEquipe({ ok: true, entregador_id: entregadorId })
}
