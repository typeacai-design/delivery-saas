import { NextRequest, NextResponse } from 'next/server'
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
 * POST /api/auth/membro-login
 * Body: { username, senha, perfil }
 *
 * Valida credenciais do membro da equipe e retorna os dados para o frontend
 * armazenar no localStorage.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const username = String(body.username || '').toLowerCase().trim()
  const senha = String(body.senha || '')
  const perfil = body.perfil

  if (!username || !senha) {
    return NextResponse.json({ error: 'Usuário e senha obrigatórios' }, { status: 400 })
  }

  if (!perfil || !['attendant', 'cozinha', 'motoboy'].includes(perfil)) {
    return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 })
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
  if (!membro.ativo) return NextResponse.json({ error: 'Usuário inativo. Contate o administrador.' }, { status: 401 })
  if (membro.perfil !== perfil) {
    return NextResponse.json({ error: 'Este usuário não tem acesso a esta área.' }, { status: 403 })
  }
  if (membro.password_hash !== senha) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  return NextResponse.json({
    membro: {
      id: membro.id,
      nome: membro.nome,
      username: membro.username,
      tenant_id: membro.tenant_id,
      perfil: membro.perfil,
    },
  })
}
