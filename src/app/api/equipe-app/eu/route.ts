import { equipeAutenticada, respostaEquipe } from '@/lib/equipe-server'
import { distribuirAutomatico } from '@/lib/entregas'

/** Dados de quem está logado na área da equipe. Motoboy também troca Disponível/Inativo aqui. */
export async function GET() {
  const ctx = await equipeAutenticada(['kitchen', 'attendant', 'motoboy'])
  if ('erro' in ctx) return ctx.erro
  const [{ data: vinculo }, { data: loja }] = await Promise.all([
    ctx.admin.from('usuarios_loja').select('nome, role, disponivel').eq('tenant_id', ctx.tenantId).eq('user_id', ctx.userId).single(),
    ctx.admin.from('tenants').select('nome').eq('id', ctx.tenantId).single(),
  ])
  return respostaEquipe({ nome: vinculo?.nome || '', funcao: ctx.funcao, disponivel: vinculo?.disponivel === true, loja: loja?.nome || '', tenantId: ctx.tenantId })
}

export async function PATCH(request: Request) {
  const ctx = await equipeAutenticada(['motoboy'])
  if ('erro' in ctx) return ctx.erro
  const body = await request.json().catch(() => null) as { disponivel?: unknown } | null
  if (typeof body?.disponivel !== 'boolean') return respostaEquipe({ error: 'Dados inválidos' }, 400)
  const { error } = await ctx.admin.from('usuarios_loja').update({ disponivel: body.disponivel }).eq('tenant_id', ctx.tenantId).eq('user_id', ctx.userId)
  if (error) return respostaEquipe({ error: 'Não foi possível atualizar' }, 500)
  // No modo automático, quem fica disponível já recebe entregas que estavam esperando.
  if (body.disponivel) await distribuirAutomatico(ctx.admin, ctx.tenantId)
  return respostaEquipe({ disponivel: body.disponivel })
}
