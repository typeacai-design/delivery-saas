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
 * POST /api/membros-equipe/login
 * Body: { username, senha }
 * Bypassa RLS usando service_role. Valida username + senha e retorna dados do membro.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const username = String(body.username || '').toLowerCase().trim()
  const senha = String(body.senha || '')

  if (!username || !senha) {
    return NextResponse.json({ error: 'Usuário e senha são obrigatórios' }, { status: 400 })
  }

  const admin = adminClient()

  const { data: membro, error } = await admin
    .from('membros_equipe')
    .select('id, tenant_id, nome, username, perfil, ativo, password_hash')
    .eq('username', username)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Erro ao buscar membro' }, { status: 500 })
  if (!membro) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 })
  if (!membro.ativo) return NextResponse.json({ error: 'Usuário inativo' }, { status: 401 })
  if (membro.password_hash !== senha) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  return NextResponse.json({
    membro: {
      id: membro.id,
      tenant_id: membro.tenant_id,
      nome: membro.nome,
      username: membro.username,
      perfil: membro.perfil,
    },
  })
}
