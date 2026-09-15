import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyEquipeSenha } from '@/lib/equipe-auth'

const adminClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const username = String(body?.username || '').trim().toLowerCase()
    const senha = String(body?.senha || '')

    if (!username || !senha) {
      return NextResponse.json({ error: 'Informe usuário e senha.' }, { status: 400 })
    }

    const admin = adminClient()
    const { data: membro, error } = await admin
      .from('membros_equipe')
      .select('id, nome, username, password_hash, perfil, ativo, tenant_id')
      .eq('username', username)
      .maybeSingle()

    if (error) throw error
    if (!membro) return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 401 })
    if (!membro.ativo) return NextResponse.json({ error: 'Acesso desativado. Fale com o lojista.' }, { status: 403 })
    if (!['cozinha', 'motoboy', 'atendimento'].includes(membro.perfil)) {
      return NextResponse.json({ error: 'Perfil sem acesso operacional.' }, { status: 403 })
    }

    const senhaOk = verifyEquipeSenha(senha, membro.password_hash)
    if (!senhaOk) return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 401 })

    return NextResponse.json({
      membro: {
        id: membro.id,
        nome: membro.nome,
        username: membro.username,
        perfil: membro.perfil,
        tenant_id: membro.tenant_id,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
