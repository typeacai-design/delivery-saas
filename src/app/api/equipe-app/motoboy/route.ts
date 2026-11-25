import { brasiliaDay } from '@/lib/brasilia'
import { equipeAutenticada, respostaEquipe } from '@/lib/equipe-server'
import { distribuirAutomatico, ehEntrega, modoDistribuicao } from '@/lib/entregas'

const COLUNAS = 'id, codigo, status, tipo_pedido, tipo_entrega, sessao_mesa_id, cliente_nome, cliente_whatsapp, endereco_entrega, numero_entrega, complemento_entrega, bairro_entrega, forma_pagamento, troco_para, valor_total, pago, observacoes, entregador_id, data_criacao'

type Linha = Record<string, unknown>
const entrega = (p: Linha, completa: boolean) => ({
  id: p.id, codigo: p.codigo, status: p.status, bairro: p.bairro_entrega, criado_em: p.data_criacao,
  endereco: p.endereco_entrega, numero: p.numero_entrega, complemento: completa ? p.complemento_entrega : null,
  // Telefone, pagamento e observações só depois que a entrega é dele.
  ...(completa ? { cliente_nome: p.cliente_nome, telefone: p.cliente_whatsapp, forma_pagamento: p.forma_pagamento, troco_para: p.troco_para, valor_total: p.valor_total, pago: p.pago, observacoes: p.observacoes } : {}),
})

/** Painel do motoboy: entregas para pegar (se a loja deixa escolher) e as entregas dele. */
export async function GET() {
  const ctx = await equipeAutenticada(['motoboy'])
  if ('erro' in ctx) return ctx.erro
  const [{ data: tenant }, { data: eu }] = await Promise.all([
    ctx.admin.from('tenants').select('config').eq('id', ctx.tenantId).single(),
    ctx.admin.from('usuarios_loja').select('disponivel').eq('tenant_id', ctx.tenantId).eq('user_id', ctx.userId).single(),
  ])
  const modo = modoDistribuicao(tenant?.config)
  const hoje = new Date(`${brasiliaDay()}T00:00:00-03:00`).toISOString()
  const [{ data: minhas }, { data: livres }, { count: entreguesHoje }] = await Promise.all([
    ctx.admin.from('pedidos').select(COLUNAS).eq('tenant_id', ctx.tenantId).eq('entregador_id', ctx.userId).in('status', ['pronto', 'saiu']).is('deleted_at', null).order('data_criacao'),
    modo === 'motoboys_escolhem' && eu?.disponivel
      ? ctx.admin.from('pedidos').select(COLUNAS).eq('tenant_id', ctx.tenantId).eq('status', 'pronto').is('entregador_id', null).is('deleted_at', null).order('data_criacao').limit(30)
      : Promise.resolve({ data: [] as Linha[] }),
    ctx.admin.from('pedidos').select('id', { count: 'exact', head: true }).eq('tenant_id', ctx.tenantId).eq('entregador_id', ctx.userId).eq('status', 'entregue').gte('data_criacao', hoje),
  ])
  return respostaEquipe({
    modo, disponivel: eu?.disponivel === true, entreguesHoje: entreguesHoje || 0,
    minhas: (minhas || []).map(p => entrega(p, true)),
    paraPegar: (livres || []).filter(ehEntrega).map(p => entrega(p, false)),
  })
}

/** Pegar entrega (quando a loja deixa escolher), sair para entrega e confirmar entregue. */
export async function POST(request: Request) {
  const ctx = await equipeAutenticada(['motoboy'])
  if ('erro' in ctx) return ctx.erro
  const body = await request.json().catch(() => null) as { acao?: unknown; pedido_id?: unknown } | null
  const id = typeof body?.pedido_id === 'string' ? body.pedido_id : ''
  if (!id) return respostaEquipe({ error: 'Pedido inválido' }, 400)

  if (body?.acao === 'pegar') {
    const { data: tenant } = await ctx.admin.from('tenants').select('config').eq('id', ctx.tenantId).single()
    if (modoDistribuicao(tenant?.config) !== 'motoboys_escolhem') return respostaEquipe({ error: 'Nesta loja as entregas são distribuídas para você' }, 403)
    const { data: pedido } = await ctx.admin.from('pedidos').select('tipo_pedido, tipo_entrega, sessao_mesa_id').eq('id', id).eq('tenant_id', ctx.tenantId).maybeSingle()
    if (!pedido || !ehEntrega(pedido)) return respostaEquipe({ error: 'Pedido não é de entrega' }, 400)
    const { data } = await ctx.admin.from('pedidos').update({ entregador_id: ctx.userId, entregador_em: new Date().toISOString(), status: 'saiu' })
      .eq('id', id).eq('tenant_id', ctx.tenantId).eq('status', 'pronto').is('entregador_id', null).select('id').maybeSingle()
    if (!data) return respostaEquipe({ error: 'Outro motoboy já pegou esta entrega' }, 409)
    return respostaEquipe({ ok: true })
  }

  const transicao = body?.acao === 'saiu' ? ['pronto', 'saiu'] : body?.acao === 'entregue' ? ['saiu', 'entregue'] : null
  if (!transicao) return respostaEquipe({ error: 'Ação inválida' }, 400)
  const { data } = await ctx.admin.from('pedidos').update({ status: transicao[1] })
    .eq('id', id).eq('tenant_id', ctx.tenantId).eq('entregador_id', ctx.userId).eq('status', transicao[0]).select('id').maybeSingle()
  if (!data) return respostaEquipe({ error: 'Esta entrega mudou. A tela foi atualizada.' }, 409)
  if (transicao[1] === 'entregue') await distribuirAutomatico(ctx.admin, ctx.tenantId)
  return respostaEquipe({ ok: true })
}
