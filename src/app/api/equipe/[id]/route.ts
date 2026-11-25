import { MANAGEMENT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'
import { FUNCOES_EQUIPE, SENHA_MINIMA, ehFuncaoEquipe } from '@/lib/equipe'
import { adminEquipe, respostaEquipe } from '@/lib/equipe-server'
import { formatarNomeProprio } from '@/lib/nome-proprio'

async function vinculoDaLoja(id: string) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const status = tenantAuthStatus(auth)
  if (status) return { erro: respostaEquipe({ error: 'Sem permissão' }, status) } as const
  const admin = adminEquipe()
  const { data: vinculo } = await admin.from('usuarios_loja').select('id, user_id, role')
    .eq('id', id).eq('tenant_id', auth.tenantId).in('role', FUNCOES_EQUIPE).maybeSingle()
  if (!vinculo) return { erro: respostaEquipe({ error: 'Pessoa não encontrada na sua equipe' }, 404) } as const
  return { admin, vinculo, tenantId: auth.tenantId! } as const
}

/** Edita nome, função, ativo/inativo ou redefine a senha de alguém da equipe. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await vinculoDaLoja((await params).id)
  if ('erro' in ctx) return ctx.erro
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const mudancas: Record<string, unknown> = {}
  if (body?.nome !== undefined) { const nome = formatarNomeProprio(body.nome).slice(0, 120); if (!nome) return respostaEquipe({ error: 'Informe o nome' }, 400); mudancas.nome = nome }
  if (body?.funcao !== undefined) { if (!ehFuncaoEquipe(body.funcao)) return respostaEquipe({ error: 'Função inválida' }, 400); mudancas.role = body.funcao }
  if (body?.ativo !== undefined) { if (typeof body.ativo !== 'boolean') return respostaEquipe({ error: 'Dados inválidos' }, 400); mudancas.ativo = body.ativo; if (!body.ativo) mudancas.disponivel = false }

  if (body?.senha !== undefined) {
    const senha = typeof body.senha === 'string' ? body.senha : ''
    if (senha.length < SENHA_MINIMA) return respostaEquipe({ error: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres` }, 400)
    // A conta é da pessoa: se ela trabalha em outra loja, só ela troca a própria senha.
    const { count } = await ctx.admin.from('usuarios_loja').select('id', { count: 'exact', head: true }).eq('user_id', ctx.vinculo.user_id).neq('tenant_id', ctx.tenantId)
    if (count) return respostaEquipe({ error: 'Esta pessoa também trabalha em outra loja; a senha não pode ser trocada por aqui' }, 409)
    const { error } = await ctx.admin.auth.admin.updateUserById(ctx.vinculo.user_id, { password: senha })
    if (error) return respostaEquipe({ error: 'Não foi possível redefinir a senha' }, 500)
  }

  if (Object.keys(mudancas).length) {
    const { error } = await ctx.admin.from('usuarios_loja').update(mudancas).eq('id', ctx.vinculo.id)
    if (error) return respostaEquipe({ error: 'Não foi possível salvar' }, 500)
  }
  const { data } = await ctx.admin.from('usuarios_loja').select('id, nome, telefone, role, ativo, disponivel, created_at').eq('id', ctx.vinculo.id).single()
  return respostaEquipe({ membro: data })
}

/** Remove a pessoa da equipe. Sem outros vínculos, a conta dela é apagada. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await vinculoDaLoja((await params).id)
  if ('erro' in ctx) return ctx.erro
  await ctx.admin.from('push_inscricoes').delete().eq('user_id', ctx.vinculo.user_id).eq('tenant_id', ctx.tenantId)
  const { error } = await ctx.admin.from('usuarios_loja').delete().eq('id', ctx.vinculo.id)
  if (error) return respostaEquipe({ error: 'Não foi possível remover' }, 500)
  const { count } = await ctx.admin.from('usuarios_loja').select('id', { count: 'exact', head: true }).eq('user_id', ctx.vinculo.user_id)
  if (!count) await ctx.admin.auth.admin.deleteUser(ctx.vinculo.user_id)
  return respostaEquipe({ ok: true })
}
