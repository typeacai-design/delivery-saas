import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Mapeamento de perfil do frontend (login) para role canônica do sistema.
 * Mantém 'kitchen' como valor canônico para a role de cozinha.
 */
const MAPEAMENTO_PERFIL: Record<string, string> = {
  attendant: 'attendant',
  cozinha: 'kitchen',
  motoboy: 'motoboy',
}

/**
 * Destino pós-login por role canônica.
 */
const DESTINOS_POR_ROLE: Record<string, string> = {
  attendant: '/acesso/atendimento',
  kitchen: '/acesso/cozinha',
  motoboy: '/acesso/motoboy',
}

/**
 * POST /api/auth/atendente-login
 * Body: { username, senha }
 *
 * Fluxo:
 * 1) Valida username/senha contra membros_equipe
 * 2) Normaliza perfil para role canônica (cozinha → kitchen)
 * 3) Garante/busca usuário no Supabase Auth via email interno
 * 4) Mantém vínculo em usuarios_loja com a role CORRETA (não sempre 'attendant')
 * 5) Gera sessão via signInWithPassword (admin) e retorna tokens
 * 6) Retorna destino correto baseado na role
 *
 * ⚠️ Nota sobre segurança:
 * - A verificação usa password_hash no banco (dados legados podem estar em texto plano)
 * - Em produção futura, migrar para hashing bcrypt/scrypt e usar Supabase Auth diretamente
 * - Este endpoint usa service_role key — apenas para uso interno do servidor
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const username = String(body.username || '').toLowerCase().trim()
  const senha = String(body.senha || '')
  if (!username || !senha) {
    return NextResponse.json({ error: 'Usuário e senha obrigatórios' }, { status: 400 })
  }

  const admin = adminClient()
  const origin = req.headers.get('origin') || 'http://localhost:3000'

  // 1) Valida membro na equipe
  const { data: membro, error: e1 } = await admin
    .from('membros_equipe')
    .select('id, tenant_id, nome, username, perfil, ativo, password_hash')
    .eq('username', username)
    .maybeSingle()

  if (e1) return NextResponse.json({ error: 'Erro ao buscar membro' }, { status: 500 })
  if (!membro) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 })
  if (!membro.ativo) return NextResponse.json({ error: 'Usuário inativo' }, { status: 401 })

  // Valida perfil permitido
  const perfisPermitidos = Object.keys(MAPEAMENTO_PERFIL)
  if (!perfisPermitidos.includes(membro.perfil)) {
    return NextResponse.json({ error: 'Perfil sem acesso a esta área' }, { status: 403 })
  }

  // Valida senha (dados legados podem estar em texto plano — ver nota acima)
  if (membro.password_hash !== senha) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  // 2) Normaliza perfil para role canônica
  const roleCanonica = MAPEAMENTO_PERFIL[membro.perfil] || membro.perfil
  const destino = DESTINOS_POR_ROLE[roleCanonica] || '/acesso'
  const email = `${username}@atendente.we-delivery.internal`

  // 3) Busca usuário no Auth pelo email (listUsers com limite fixo)
  let authUserId: string | undefined
  const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 })
  const existingUser = usersList?.users?.find((u) => u.email === email)
  if (existingUser) {
    authUserId = existingUser.id
  }

  if (!authUserId) {
    // Cria novo usuário de autenticação
    const { data: created, error: e2 } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome: membro.nome,
        username: membro.username,
        tenant_id: membro.tenant_id,
        perfil: roleCanonica, // role correta, não sempre 'attendant'
      },
    })
    if (e2 || !created?.user?.id) {
      return NextResponse.json({ error: 'Erro ao criar usuário de autenticação: ' + (e2?.message || 'desconhecido') }, { status: 500 })
    }
    authUserId = created.user.id
  } else {
    // Mantém senha e metadados sincronizados
    await admin.auth.admin.updateUserById(authUserId, {
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome: membro.nome,
        username: membro.username,
        tenant_id: membro.tenant_id,
        perfil: roleCanonica,
      },
    })
  }

  // 4) Mantém vínculo em usuarios_loja com a role CORRETA
  const { data: existingLink } = await admin
    .from('usuarios_loja')
    .select('id')
    .eq('user_id', authUserId)
    .eq('tenant_id', membro.tenant_id)
    .maybeSingle()

  if (!existingLink) {
    await admin.from('usuarios_loja').insert({
      user_id: authUserId,
      tenant_id: membro.tenant_id,
      role: roleCanonica, // role correta
      ativo: true,
      email,
      nome: membro.nome,
    })
  } else {
    // Atualiza role para o valor correto (corrige migração de attendant legados)
    await admin.from('usuarios_loja').update({
      ativo: true,
      role: roleCanonica,
      nome: membro.nome,
    }).eq('id', existingLink.id)
  }

  // 5) Gera sessão via signInWithPassword no admin client (service role key)
  let accessToken: string | undefined
  let refreshToken: string | undefined

  const { data: sessionData, error: e3 } = await admin.auth.signInWithPassword({ email, password: senha })
  if (sessionData?.session) {
    accessToken = sessionData.session.access_token
    refreshToken = sessionData.session.refresh_token
  } else {
    return NextResponse.json({ error: 'Erro ao gerar sessão: ' + (e3?.message || 'desconhecido') }, { status: 500 })
  }

  return NextResponse.json({
    session: {
      access_token: accessToken,
      refresh_token: refreshToken,
    },
    user: {
      id: authUserId,
      email,
    },
    membro: {
      id: membro.id,
      nome: membro.nome,
      username: membro.username,
      tenant_id: membro.tenant_id,
      perfil: membro.perfil,
      role: roleCanonica,
    },
    destino, // destino correto baseado na role
  })
}
