import { brasiliaDay } from '@/lib/brasilia'
import { equipeAutenticada, respostaEquipe } from '@/lib/equipe-server'
import { COLUNAS_PEDIDO_EQUIPE, montarPedidosCozinha } from '@/lib/equipe-pedidos'

const DIA = /^\d{4}-\d{2}-\d{2}$/
const inicioDoDia = (dia: string) => new Date(`${dia}T00:00:00-03:00`).toISOString()
const fimDoDia = (dia: string) => new Date(`${dia}T23:59:59.999-03:00`).toISOString()

/**
 * Cozinha: aba Fluxo (Novo, Preparando e Pronto) ou Histórico (entregues/cancelados no período).
 * Nunca envia valores, telefone ou endereço.
 */
export async function GET(request: Request) {
  const ctx = await equipeAutenticada(['kitchen'])
  if ('erro' in ctx) return ctx.erro
  const url = new URL(request.url)
  const aba = url.searchParams.get('aba') === 'historico' ? 'historico' : 'fluxo'
  let consulta = ctx.admin.from('pedidos').select(COLUNAS_PEDIDO_EQUIPE).eq('tenant_id', ctx.tenantId).is('deleted_at', null)

  if (aba === 'fluxo') {
    // Prontos somem do quadro depois de 12h (já saíram ou foram servidos na prática).
    const limitePronto = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    consulta = consulta.or(`status.in.(novo,preparando),and(status.eq.pronto,data_criacao.gte.${limitePronto})`).order('data_criacao', { ascending: true }).limit(150)
  } else {
    const hoje = brasiliaDay()
    const de = DIA.test(url.searchParams.get('de') || '') ? url.searchParams.get('de')! : hoje
    const ate = DIA.test(url.searchParams.get('ate') || '') ? url.searchParams.get('ate')! : hoje
    consulta = consulta.in('status', ['saiu', 'entregue', 'cancelado']).gte('data_criacao', inicioDoDia(de)).lte('data_criacao', fimDoDia(ate)).order('data_criacao', { ascending: false }).limit(200)
  }
  const { data, error } = await consulta
  if (error) { console.error('cozinha_lista_falhou', error.code); return respostaEquipe({ error: 'Não foi possível carregar os pedidos' }, 500) }
  // Pedido consolidado de mesa é só a soma da comanda, não vai para a produção.
  const producao = (data || []).filter(p => p.tipo_pedido !== 'consolidado')
  return respostaEquipe({ pedidos: await montarPedidosCozinha(ctx.admin, ctx.tenantId, producao) })
}

/** Cozinha só aceita (Novo → Preparando) e finaliza (Preparando → Pronto). */
export async function POST(request: Request) {
  const ctx = await equipeAutenticada(['kitchen'])
  if ('erro' in ctx) return ctx.erro
  const body = await request.json().catch(() => null) as { pedido_id?: unknown; status?: unknown } | null
  const pedidoId = typeof body?.pedido_id === 'string' ? body.pedido_id : ''
  const novo = body?.status
  const anterior = novo === 'preparando' ? 'novo' : novo === 'pronto' ? 'preparando' : null
  if (!pedidoId || !anterior) return respostaEquipe({ error: 'Etapa não permitida para a cozinha' }, 400)
  const { data, error } = await ctx.admin.from('pedidos').update({ status: novo }).eq('id', pedidoId).eq('tenant_id', ctx.tenantId).eq('status', anterior).select('id, status').maybeSingle()
  if (error) return respostaEquipe({ error: 'Não foi possível atualizar' }, 500)
  if (!data) return respostaEquipe({ error: 'Este pedido já mudou de etapa. A tela foi atualizada.' }, 409)
  return respostaEquipe({ pedido: data })
}
