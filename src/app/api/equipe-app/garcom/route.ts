import { brasiliaDay } from '@/lib/brasilia'
import { equipeAutenticada, respostaEquipe } from '@/lib/equipe-server'
import { formatarNomeProprio } from '@/lib/nome-proprio'

const DIA = /^\d{4}-\d{2}-\d{2}$/
const FORMAS = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito']

/** Garçom: mesas com comandas e pedidos (aba Mesas) ou comandas fechadas no período (Histórico). */
export async function GET(request: Request) {
  const ctx = await equipeAutenticada(['attendant'])
  if ('erro' in ctx) return ctx.erro
  const url = new URL(request.url)

  if (url.searchParams.get('aba') === 'historico') {
    const hoje = brasiliaDay()
    const de = DIA.test(url.searchParams.get('de') || '') ? url.searchParams.get('de')! : hoje
    const ate = DIA.test(url.searchParams.get('ate') || '') ? url.searchParams.get('ate')! : hoje
    const { data, error } = await ctx.admin.from('sessoes_mesa')
      .select('id, mesa_numero, cliente_nome, valor_total, forma_pagamento, data_abertura, data_fechamento, fechada_por')
      .eq('tenant_id', ctx.tenantId).eq('status', 'fechada')
      .gte('data_fechamento', new Date(`${de}T00:00:00-03:00`).toISOString()).lte('data_fechamento', new Date(`${ate}T23:59:59.999-03:00`).toISOString())
      .order('data_fechamento', { ascending: false }).limit(200)
    if (error) return respostaEquipe({ error: 'Não foi possível carregar o histórico' }, 500)
    const quem = [...new Set((data || []).map(s => s.fechada_por).filter(Boolean))] as string[]
    const { data: nomes } = quem.length ? await ctx.admin.from('usuarios_loja').select('user_id, nome').eq('tenant_id', ctx.tenantId).in('user_id', quem) : { data: [] }
    const nomePor = new Map((nomes || []).map(n => [n.user_id as string, n.nome as string]))
    return respostaEquipe({ comandas: (data || []).map(s => ({ ...s, fechada_por: s.fechada_por ? nomePor.get(s.fechada_por) || 'Loja' : null })) })
  }

  const [{ data: mesas }, { data: sessoes }, { data: tenant }] = await Promise.all([
    ctx.admin.from('mesas').select('id, numero, nome, qr_token').eq('tenant_id', ctx.tenantId).eq('ativa', true).order('numero'),
    ctx.admin.from('sessoes_mesa').select('id, mesa_numero, cliente_nome, valor_total, data_abertura').eq('tenant_id', ctx.tenantId).eq('status', 'aberta'),
    ctx.admin.from('tenants').select('slug').eq('id', ctx.tenantId).single(),
  ])
  const ids = (sessoes || []).map(s => s.id)
  const { data: pedidos } = ids.length
    ? await ctx.admin.from('pedidos').select('id, codigo, status, valor_total, sessao_mesa_id, data_criacao, cliente_nome').eq('tenant_id', ctx.tenantId).in('sessao_mesa_id', ids).is('deleted_at', null).order('data_criacao')
    : { data: [] }
  const pedidoIds = (pedidos || []).map(p => p.id)
  const { data: itens } = pedidoIds.length ? await ctx.admin.from('pedido_itens').select('pedido_id, nome, quantidade').in('pedido_id', pedidoIds) : { data: [] }
  const itensPor = new Map<string, { nome: string; quantidade: number }[]>()
  for (const i of itens || []) itensPor.set(i.pedido_id, [...(itensPor.get(i.pedido_id) || []), { nome: i.nome, quantidade: i.quantidade }])

  const resultado = (mesas || []).map(m => {
    const sessao = (sessoes || []).find(s => String(s.mesa_numero) === String(m.numero)) || null
    const lista = sessao ? (pedidos || []).filter(p => p.sessao_mesa_id === sessao.id).map(p => ({ ...p, itens: itensPor.get(p.id) || [] })) : []
    return { mesa: m, sessao, pedidos: lista, prontos: lista.filter(p => p.status === 'pronto').length }
  })
  return respostaEquipe({ mesas: resultado, slug: tenant?.slug || '' })
}

/** Ações do garçom: abrir comanda, marcar servido e fechar a conta com o pagamento. */
export async function POST(request: Request) {
  const ctx = await equipeAutenticada(['attendant'])
  if ('erro' in ctx) return ctx.erro
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const acao = body?.acao

  if (acao === 'abrir') {
    const nome = formatarNomeProprio(body?.cliente_nome).slice(0, 120) || 'Cliente'
    const { data: mesa } = await ctx.admin.from('mesas').select('numero').eq('id', String(body?.mesa_id || '')).eq('tenant_id', ctx.tenantId).eq('ativa', true).maybeSingle()
    if (!mesa) return respostaEquipe({ error: 'Mesa não encontrada' }, 404)
    const { data, error } = await ctx.admin.from('sessoes_mesa').insert({ tenant_id: ctx.tenantId, mesa_numero: String(mesa.numero), cliente_nome: nome, status: 'aberta' }).select('id').single()
    if (error) return respostaEquipe({ error: error.code === '23505' ? 'Esta mesa já tem comanda aberta' : 'Não foi possível abrir a comanda' }, error.code === '23505' ? 409 : 500)
    return respostaEquipe({ sessao: data })
  }

  if (acao === 'servido') {
    const { data: pedido } = await ctx.admin.from('pedidos').select('id, sessao_mesa_id').eq('id', String(body?.pedido_id || '')).eq('tenant_id', ctx.tenantId).maybeSingle()
    if (!pedido?.sessao_mesa_id) return respostaEquipe({ error: 'Só pedidos de mesa podem ser marcados como servidos' }, 400)
    const { data } = await ctx.admin.from('pedidos').update({ status: 'entregue' }).eq('id', pedido.id).eq('status', 'pronto').select('id').maybeSingle()
    if (!data) return respostaEquipe({ error: 'Este pedido ainda não está pronto ou já foi servido' }, 409)
    return respostaEquipe({ ok: true })
  }

  if (acao === 'fechar') {
    const forma = String(body?.forma_pagamento || '')
    if (!FORMAS.includes(forma)) return respostaEquipe({ error: 'Selecione a forma de pagamento' }, 400)
    const valor = forma === 'dinheiro' && body?.valor_pago != null && body.valor_pago !== '' ? Number(body.valor_pago) : null
    if (valor !== null && (!Number.isFinite(valor) || valor < 0)) return respostaEquipe({ error: 'Valor recebido inválido' }, 400)
    const sessaoId = String(body?.sessao_id || '')
    const { data, error } = await ctx.admin.rpc('fechar_sessao_mesa_financeiro', { p_tenant_id: ctx.tenantId, p_sessao_id: sessaoId, p_forma_pagamento: forma, p_valor_entregue: valor })
    if (error) return respostaEquipe({ error: error.message || 'Não foi possível fechar a conta' }, 409)
    await ctx.admin.from('sessoes_mesa').update({ fechada_por: ctx.userId }).eq('id', sessaoId).eq('tenant_id', ctx.tenantId)
    return respostaEquipe({ ok: true, resultado: data })
  }
  return respostaEquipe({ error: 'Ação inválida' }, 400)
}
