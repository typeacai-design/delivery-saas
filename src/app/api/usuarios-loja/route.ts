/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { hashEquipeSenha, verifyEquipeSenha } from '@/lib/equipe-auth'

const adminClient = () => createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const ROLES_OPERACIONAIS = ['kitchen', 'motoboy', 'atendimento']
// Aceita registros legados com perfil 'attendant' (migrados para 'atendimento')
const ROLES_VALIDAS_NO_BANCO = ['kitchen', 'motoboy', 'atendimento', 'attendant']
const ROLES_PERMITIDAS_LABEL: Record<string, string> = {
  kitchen: 'cozinha',
  motoboy: 'motoboy',
  atendimento: 'atendimento',
  attendant: 'atendimento',
}

export async function GET() {
  try {
    const { user, tenantId, role } = await authenticatedTenant(['owner', 'manager'])
    if (!user || !tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

    const admin = adminClient()
    const { data: membros, error } = await admin
      .from('membros_equipe')
      .select('id, nome, username, perfil, ativo, created_at')
      .eq('tenant_id', tenantId)
      .eq('ativo', true)
      .order('created_at')

    if (error) throw error

    const lista = (membros || []).map((m: any) => ({
      id: m.id,
      nome: m.nome,
      username: m.username,
      // mantém compatibilidade com o frontend atual (lê m.email e m.role)
      email: m.username,
      // normaliza 'attendant' legado para 'atendimento'
      role: m.perfil === 'attendant' ? 'atendimento' : m.perfil,
      perfil_real: m.perfil,
      ativo: m.ativo,
    }))

    return NextResponse.json({ usuarios: lista, can_manage: role === 'owner' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { user, tenantId, role: actorRole } = await authenticatedTenant(['owner'])
    if (!user || !tenantId) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    if (actorRole !== 'owner') return NextResponse.json({ error: 'Apenas o dono pode criar acessos' }, { status: 403 })

    const body = await request.json()
    const { nome, username, senha, perfil } = body

    // Normalização
    const nomeLimpo = String(nome || '').trim()
    const userLimpo = String(username || '').trim().toLowerCase()
    const senhaLimpa = String(senha || '')
    const perfilLimpo = String(perfil || '')

    if (!nomeLimpo || !userLimpo || !senhaLimpa || !ROLES_OPERACIONAIS.includes(perfilLimpo)) {
      return NextResponse.json({ error: 'Preencha nome, usuário, senha e função.' }, { status: 400 })
    }
    if (userLimpo.length < 3 || userLimpo.length > 40) {
      return NextResponse.json({ error: 'Usuário deve ter entre 3 e 40 caracteres.' }, { status: 400 })
    }
    if (!/^[a-z0-9._-]+$/.test(userLimpo)) {
      return NextResponse.json({ error: 'Use apenas letras minúsculas, números, ponto, hífen ou underline.' }, { status: 400 })
    }
    if (senhaLimpa.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 })
    }

    const admin = adminClient()

    // Verifica username único
    const { data: existing } = await admin
      .from('membros_equipe')
      .select('id')
      .eq('username', userLimpo)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Este usuário já existe. Escolha outro.' }, { status: 409 })
    }

    const password_hash = hashEquipeSenha(senhaLimpa)

    const { data, error } = await admin
      .from('membros_equipe')
      .insert({
        tenant_id: tenantId,
        nome: nomeLimpo.slice(0, 160),
        username: userLimpo,
        password_hash,
        perfil: perfilLimpo,
        ativo: true,
      })
      .select('id, nome, username, perfil, ativo, created_at')
      .single()

    if (error) {
      if ((error as any).code === '23505') {
        return NextResponse.json({ error: 'Este usuário já existe. Escolha outro.' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({
      id: data.id,
      nome: data.nome,
      username: data.username,
      email: data.username,
      role: data.perfil,
      ativo: data.ativo,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, tenantId, role: actorRole } = await authenticatedTenant(['owner'])
    if (!user || !tenantId) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    if (actorRole !== 'owner') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const body = await request.json()
    const { id, nome, senha, perfil, ativo } = body

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const perfilLimpo = perfil ? String(perfil) : null
    if (perfilLimpo && !ROLES_OPERACIONAIS.includes(perfilLimpo)) {
      return NextResponse.json({ error: 'Função inválida' }, { status: 400 })
    }

    if (typeof ativo !== 'boolean') {
      return NextResponse.json({ error: 'Campo ativo inválido' }, { status: 400 })
    }

    const admin = adminClient()
    const { data: target } = await admin
      .from('membros_equipe')
      .select('id, perfil')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (!target || !ROLES_OPERACIONAIS.includes(target.perfil)) {
      return NextResponse.json({ error: 'Acesso não permitido' }, { status: 403 })
    }

    const update: any = {}
    if (nome !== undefined) update.nome = String(nome).slice(0, 160)
    if (perfilLimpo) update.perfil = perfilLimpo
    if (ativo !== undefined) update.ativo = !!ativo
    if (senha) {
      const senhaLimpa = String(senha)
      if (senhaLimpa.length < 6) return NextResponse.json({ error: 'Senha deve ter ao menos 6 caracteres.' }, { status: 400 })
      update.password_hash = hashEquipeSenha(senhaLimpa)
    }
    update.updated_at = new Date().toISOString()

    const { data, error } = await admin
      .from('membros_equipe')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, nome, username, perfil, ativo, created_at')
      .single()

    if (error) throw error

    return NextResponse.json({
      id: data.id,
      nome: data.nome,
      username: data.username,
      email: data.username,
      role: data.perfil,
      ativo: data.ativo,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, tenantId: initialTenantId, role: actorRole } = await authenticatedTenant(['owner'])
    let tenantId = initialTenantId
    if (!user || !tenantId) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    if (actorRole !== 'owner') return NextResponse.json({ error: 'Apenas owner pode remover' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID necessário' }, { status: 400 })

    const admin = adminClient()
    // Buscar o membro por ID — primeiro no tenant ativo; se não achar, em qualquer tenant do owner
    let { data: target } = await admin
      .from('membros_equipe')
      .select('id, perfil, tenant_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!target) {
      // Fallback: se o usuário é owner do tenant do membro, permite
      const { data: ownedTenants } = await admin.from('tenants').select('id').eq('owner_id', user.id)
      const ownedIds = new Set((ownedTenants || []).map((t: any) => t.id))
      const { data: anyMember } = await admin
        .from('membros_equipe')
        .select('id, perfil, tenant_id')
        .eq('id', id)
        .maybeSingle()
      if (anyMember && ownedIds.has(anyMember.tenant_id)) {
        target = anyMember
        // usa o tenantId correto do membro
        tenantId = anyMember.tenant_id
      }
    }

    if (!target || !ROLES_VALIDAS_NO_BANCO.includes(target.perfil)) {
      console.error('[usuarios-loja DELETE] target null ou perfil inválido', { id, tenantId, userId: user.id })
      return NextResponse.json({ error: 'Acesso não permitido' }, { status: 403 })
    }

    // Soft delete via ativo=false (mais seguro e reversível)
    const { error } = await admin
      .from('membros_equipe')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[usuarios-loja DELETE]', error?.message, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const _rolesOperacionais = ROLES_OPERACIONAIS
export const _rolesLabelMap = ROLES_PERMITIDAS_LABEL
export { verifyEquipeSenha }
