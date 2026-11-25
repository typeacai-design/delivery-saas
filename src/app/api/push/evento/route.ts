import { timingSafeEqual } from 'node:crypto'
import { adminEquipe, respostaEquipe } from '@/lib/equipe-server'
import { enviarPush } from '@/lib/push-server'
import { distribuirAutomatico, ehEntrega, modoDistribuicao, motoboysDisponiveis } from '@/lib/entregas'

const segredoConfere = (recebido: string | null) => {
  const esperado = process.env.WD_PUSH_SEGREDO || ''
  if (!esperado || !recebido || recebido.length !== esperado.length) return false
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))
}

async function usuariosDaFuncao(admin: ReturnType<typeof adminEquipe>, tenantId: string, role: string) {
  const { data } = await admin.from('usuarios_loja').select('user_id').eq('tenant_id', tenantId).eq('role', role).eq('ativo', true)
  return (data || []).map(u => u.user_id as string)
}

/**
 * Chamado pelo banco (trigger trg_equipe_avisar_pedido, via pg_net) quando um pedido entra,
 * muda de etapa ou ganha entregador. Decide quem da equipe recebe a notificação.
 */
export async function POST(request: Request) {
  if (!segredoConfere(request.headers.get('x-wd-segredo'))) return respostaEquipe({ error: 'Não autorizado' }, 401)
  const body = await request.json().catch(() => null) as { pedido_id?: string; evento?: string } | null
  if (!body?.pedido_id) return respostaEquipe({ error: 'Dados inválidos' }, 400)
  const admin = adminEquipe()
  const { data: p } = await admin.from('pedidos')
    .select('id, tenant_id, codigo, status, tipo_pedido, tipo_entrega, sessao_mesa_id, entregador_id, bairro_entrega')
    .eq('id', body.pedido_id).maybeSingle()
  if (!p) return respostaEquipe({ ok: true })
  const codigo = p.codigo ? `#${p.codigo}` : 'novo'

  if (body.evento === 'novo' && (p.status === 'novo' || p.status === 'preparando')) {
    await enviarPush(admin, p.tenant_id, await usuariosDaFuncao(admin, p.tenant_id, 'kitchen'),
      { titulo: 'Novo pedido', corpo: `Pedido ${codigo} chegou na cozinha`, url: '/acesso/cozinha', tag: `pedido-${p.id}` })
  }

  if (body.evento === 'status' && p.status === 'pronto') {
    if (!ehEntrega(p) && (p.tipo_pedido === 'mesa' || p.sessao_mesa_id)) {
      const { data: sessao } = p.sessao_mesa_id ? await admin.from('sessoes_mesa').select('mesa_numero').eq('id', p.sessao_mesa_id).maybeSingle() : { data: null }
      await enviarPush(admin, p.tenant_id, await usuariosDaFuncao(admin, p.tenant_id, 'attendant'),
        { titulo: sessao ? `Mesa ${sessao.mesa_numero}` : 'Pedido de mesa', corpo: `Pedido ${codigo} pronto para servir`, url: '/acesso/garcom', tag: `servir-${p.id}` })
    } else if (ehEntrega(p) && !p.entregador_id) {
      const { data: tenant } = await admin.from('tenants').select('config').eq('id', p.tenant_id).single()
      const modo = modoDistribuicao(tenant?.config)
      if (modo === 'automatico') await distribuirAutomatico(admin, p.tenant_id) // a atribuição dispara o aviso ao escolhido
      else if (modo === 'motoboys_escolhem') {
        const motoboys = await motoboysDisponiveis(admin, p.tenant_id)
        await enviarPush(admin, p.tenant_id, motoboys.map(m => m.user_id as string),
          { titulo: 'Entrega pronta', corpo: `Pedido ${codigo}${p.bairro_entrega ? ` · ${p.bairro_entrega}` : ''} aguardando motoboy`, url: '/acesso/motoboy', tag: `entrega-${p.id}` })
      }
    }
  }

  if (body.evento === 'entregador' && p.entregador_id && (p.status === 'pronto' || p.status === 'saiu')) {
    await enviarPush(admin, p.tenant_id, [p.entregador_id],
      { titulo: 'Nova entrega para você', corpo: `Pedido ${codigo}${p.bairro_entrega ? ` · ${p.bairro_entrega}` : ''}`, url: '/acesso/motoboy', tag: `entrega-${p.id}` })
  }
  return respostaEquipe({ ok: true })
}
