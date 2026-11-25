import { MANAGEMENT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'
import { FUNCOES_EQUIPE, SENHA_MINIMA, ehFuncaoEquipe, emailInternoEquipe, normalizarCelular } from '@/lib/equipe'
import { adminEquipe, respostaEquipe } from '@/lib/equipe-server'
import { formatarNomeProprio } from '@/lib/nome-proprio'

/** Equipe da loja (lojista): lista e cadastro de Cozinha, Garçom e Motoboy. */
export async function GET() {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const status = tenantAuthStatus(auth)
  if (status) return respostaEquipe({ error: 'Sem permissão' }, status)
  const { data, error } = await adminEquipe().from('usuarios_loja')
    .select('id, user_id, nome, telefone, role, ativo, disponivel, created_at')
    .eq('tenant_id', auth.tenantId).in('role', FUNCOES_EQUIPE).order('nome')
  if (error) return respostaEquipe({ error: 'Não foi possível carregar a equipe' }, 500)
  return respostaEquipe({ equipe: data || [] })
}

export async function POST(request: Request) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const status = tenantAuthStatus(auth)
  if (status) return respostaEquipe({ error: 'Sem permissão' }, status)
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const nome = formatarNomeProprio(body?.nome).slice(0, 120)
  const celular = normalizarCelular(body?.celular)
  const senha = typeof body?.senha === 'string' ? body.senha : ''
  const funcao = body?.funcao
  if (!nome) return respostaEquipe({ error: 'Informe o nome' }, 400)
  if (!celular) return respostaEquipe({ error: 'Celular inválido. Use DDD + número.' }, 400)
  if (!ehFuncaoEquipe(funcao)) return respostaEquipe({ error: 'Escolha a função' }, 400)

  const admin = adminEquipe()
  const email = emailInternoEquipe(celular)
  const { data: existente } = await admin.rpc('equipe_usuario_por_email', { p_email: email })
  let userId = (existente as string | null) || null
  let jaTinhaConta = Boolean(userId)

  if (!userId) {
    if (senha.length < SENHA_MINIMA) return respostaEquipe({ error: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres` }, 400)
    const { data: criado, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome, celular, tipo: 'equipe' } })
    if (error || !criado.user) {
      // Corrida: outra loja criou a mesma pessoa agora.
      const { data: deNovo } = await admin.rpc('equipe_usuario_por_email', { p_email: email })
      if (!deNovo) return respostaEquipe({ error: 'Não foi possível criar o acesso' }, 500)
      userId = deNovo as string; jaTinhaConta = true
    } else userId = criado.user.id
  }

  const { data: vinculoAtual } = await admin.from('usuarios_loja').select('id, role').eq('tenant_id', auth.tenantId).eq('user_id', userId).maybeSingle()
  if (vinculoAtual) return respostaEquipe({ error: vinculoAtual.role === 'owner' || vinculoAtual.role === 'manager' ? 'Este celular é de um administrador da loja' : 'Este celular já faz parte da sua equipe' }, 409)

  const { data: vinculo, error: erroVinculo } = await admin.from('usuarios_loja')
    .insert({ tenant_id: auth.tenantId, user_id: userId, role: funcao, nome, telefone: celular, email, ativo: true })
    .select('id, nome, telefone, role, ativo, disponivel, created_at').single()
  if (erroVinculo) {
    if (!jaTinhaConta) await admin.auth.admin.deleteUser(userId!)
    console.error('equipe_vinculo_falhou', erroVinculo.code)
    return respostaEquipe({ error: 'Não foi possível cadastrar' }, 500)
  }
  return respostaEquipe({ membro: vinculo, jaTinhaConta }, 201)
}
