import { NextRequest, NextResponse } from 'next/server'
import { MANAGEMENT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'
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
 * Hash simples (apenas comparação de string)
 * Em produção, substituir por bcrypt — mas como o sistema atual usa comparação direta,
 * mantemos consistência para não quebrar a tela /acesso.
 */
function hashSenha(plain: string): string {
  return plain
}

/**
 * GET /api/membros-equipe
 * Lista membros da equipe do tenant (sem expor senha)
 */
export async function GET() {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const authStatus = tenantAuthStatus(auth)
  if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão' }, { status: authStatus })

  const { supabase, tenantId } = auth
  const { data, error } = await supabase
    .from('membros_equipe')
    .select('id, tenant_id, nome, username, perfil, ativo, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ membros: data || [] })
}

/**
 * POST /api/membros-equipe
 * Cria novo membro (apenas cozinha/motoboy/attendant — owner só pode ser criado via convite inicial)
 * Body: { nome, username, senha, perfil }
 */
export async function POST(req: NextRequest) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const authStatus = tenantAuthStatus(auth)
  if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão' }, { status: authStatus })

  const { tenantId, supabase } = auth
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const { nome, username, senha, perfil } = body

  if (!nome || !username || !senha || !perfil) {
    return NextResponse.json({ error: 'nome, username, senha e perfil são obrigatórios' }, { status: 400 })
  }

  const perfisPermitidos = ['attendant', 'cozinha', 'motoboy']
  if (!perfisPermitidos.includes(perfil)) {
    return NextResponse.json({ error: 'Perfil inválido. Use attendant, cozinha ou motoboy.' }, { status: 400 })
  }

  if (senha.length < 4) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 4 caracteres' }, { status: 400 })
  }

  const usernameNorm = String(username).toLowerCase().trim().replace(/[^a-z0-9_]/g, '').slice(0, 30)
  if (usernameNorm.length < 3) {
    return NextResponse.json({ error: 'Username deve ter ao menos 3 caracteres (letras, números, _)' }, { status: 400 })
  }

  // Verifica duplicidade de username (constraint é global UNIQUE)
  const admin = adminClient()
  const { data: existing } = await admin
    .from('membros_equipe')
    .select('id, tenant_id')
    .eq('username', usernameNorm)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Este username já está em uso. Escolha outro.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('membros_equipe')
    .insert({
      tenant_id: tenantId,
      nome: String(nome).trim().slice(0, 80),
      username: usernameNorm,
      password_hash: hashSenha(String(senha)),
      perfil,
      ativo: true,
    })
    .select('id, tenant_id, nome, username, perfil, ativo')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ membro: data })
}

/**
 * PATCH /api/membros-equipe?id=<uuid>
 * Atualiza nome, senha, ativo
 */
export async function PATCH(req: NextRequest) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const authStatus = tenantAuthStatus(auth)
  if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão' }, { status: authStatus })

  const { tenantId, supabase } = auth
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const update: any = {}
  if (body.nome !== undefined) update.nome = String(body.nome).trim().slice(0, 80)
  if (body.senha !== undefined) {
    if (String(body.senha).length < 4) {
      return NextResponse.json({ error: 'Senha deve ter pelo menos 4 caracteres' }, { status: 400 })
    }
    update.password_hash = hashSenha(String(body.senha))
  }
  if (body.ativo !== undefined) update.ativo = !!body.ativo

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('membros_equipe')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id, nome, username, perfil, ativo')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ membro: data })
}

/**
 * DELETE /api/membros-equipe?id=<uuid>
 */
export async function DELETE(req: NextRequest) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const authStatus = tenantAuthStatus(auth)
  if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão' }, { status: authStatus })

  const { tenantId, supabase } = auth
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase
    .from('membros_equipe')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
