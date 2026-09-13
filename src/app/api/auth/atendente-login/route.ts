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
 * POST /api/auth/atendente-login
 * Body: { username, senha }
 *
 * 1) Valida username/senha contra membros_equipe
 * 2) Garante usuário no Supabase Auth com email interno derivado (atendente-{username}@atendente.we-delivery.internal)
 * 3) Garante vínculo em usuarios_loja com role 'attendant'
 * 4) Loga via signInWithPassword (admin) e retorna os tokens para o client fazer setSession
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

  // 1) Valida membro
  const { data: membro, error: e1 } = await admin
    .from('membros_equipe')
    .select('id, tenant_id, nome, username, perfil, ativo, password_hash')
    .eq('username', username)
    .maybeSingle()

  if (e1) return NextResponse.json({ error: 'Erro ao buscar membro' }, { status: 500 })
  if (!membro) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 })
  if (!membro.ativo) return NextResponse.json({ error: 'Usuário inativo' }, { status: 401 })
  if (membro.perfil !== 'attendant' && membro.perfil !== 'cozinha' && membro.perfil !== 'motoboy') {
    return NextResponse.json({ error: 'Perfil sem acesso a esta área' }, { status: 403 })
  }
  if (membro.password_hash !== senha) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  const email = `${username}@atendente.we-delivery.internal`

  // 2) Verifica se usuário já existe no Auth
  let authUserId: string | undefined
  let page = 1
  while (true) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    const found = data?.users?.find((u) => u.email === email)
    if (found) {
      authUserId = found.id
      break
    }
    if (!data || (data.users?.length || 0) < 200) break
    page++
  }

  if (!authUserId) {
    const { data: created, error: e2 } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome: membro.nome, username: membro.username, tenant_id: membro.tenant_id, perfil: 'attendant' },
    })
    if (e2 || !created?.user?.id) {
      return NextResponse.json({ error: 'Erro ao criar usuário de autenticação: ' + (e2?.message || 'desconhecido') }, { status: 500 })
    }
    authUserId = created.user.id
  } else {
    // Mantém senha sincronizada
    await admin.auth.admin.updateUserById(authUserId, { password: senha, email_confirm: true })
  }

  // 3) Garante vínculo em usuarios_loja
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
      role: 'attendant',
      ativo: true,
      email,
      nome: membro.nome,
    })
  } else {
    await admin.from('usuarios_loja').update({ ativo: true, role: 'attendant', nome: membro.nome }).eq('id', existingLink.id)
  }

  // 4) Gera link mágico e troca por sessão (funciona sem precisar confirmar email)
  const { data: linkData, error: e4 } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${req.headers.get('origin') || 'http://localhost:3000'}/pedidos` },
  })

  if (e4 || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: 'Erro ao gerar link de autenticação: ' + (e4?.message || 'desconhecido') }, { status: 500 })
  }

  // Extrai token do action_link (formato: .../auth/v1/verify?token=...&type=magiclink)
  const url = new URL(linkData.properties.action_link)
  const token = url.searchParams.get('token')

  // Verifica token pra obter sessão
  const { data: sessionData, error: e5 } = await admin.auth.verifyOtp({
    token_hash: token!,
    type: 'magiclink',
  })

  if (e5 || !sessionData?.session) {
    return NextResponse.json({ error: 'Erro ao verificar sessão: ' + (e5?.message || 'desconhecido') }, { status: 500 })
  }

  return NextResponse.json({
    session: {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
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
    },
  })
}
