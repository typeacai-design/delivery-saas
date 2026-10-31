import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { hasGoogleIdentity } from '@/lib/google-auth'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  let createdUserId: string | null = null
  let googleTenantId: string | null = null
  try {
    const body = await request.json()
    const { nome, slug, email, password, categoria, telefone, estado, cidade, endereco, numero, nome_responsavel, cpf, referral_code } = body
    const useGoogle = body.auth_provider === 'google'
    let googleUserId: string | null = null
    let normalizedEmail = String(email || '').trim().toLowerCase()
    if (useGoogle) {
      if (request.headers.get('origin') !== new URL(request.url).origin) {
        return NextResponse.json({ error: 'Origem não permitida.' }, { status: 403 })
      }
      const sessionClient = await createSessionClient()
      const { data: { user }, error } = await sessionClient.auth.getUser()
      if (error || !hasGoogleIdentity(user)) return NextResponse.json({ error: 'Entre com Google para continuar.' }, { status: 401 })
      googleUserId = user!.id
      normalizedEmail = user!.email!.trim().toLowerCase()
    }
    if (!nome || !slug || !normalizedEmail || (!useGoogle && !password)) {
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 })
    }
    if (!useGoogle && String(password).length < 8) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres' }, { status: 400 })
    }

    const admin = getAdminClient()
    if (useGoogle) {
      const { data: memberships, error: memberLookupError } = await admin.from('usuarios_loja').select('tenant_id').eq('user_id', googleUserId!).limit(1)
      if (memberLookupError) throw memberLookupError
      if (memberships?.length) return NextResponse.json({ error: 'Esta conta já está vinculada a uma loja. Entre novamente para acessá-la.' }, { status: 409 })
      const { data: ownedTenant, error: ownedError } = await admin.from('tenants').select('id').eq('id', googleUserId!).maybeSingle()
      if (ownedError) throw ownedError
      if (ownedTenant) return NextResponse.json({ error: 'Já existe uma loja vinculada. Contate o suporte para recuperar o acesso.' }, { status: 409 })
    } else {
      const { data: existingUsers } = await admin.auth.admin.listUsers()
      if (existingUsers?.users?.some((u) => u.email?.toLowerCase() === normalizedEmail)) {
        return NextResponse.json({ error: 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.' }, { status: 409 })
      }
    }
    const { data: existingSlug } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle()
    if (existingSlug) return NextResponse.json({ error: 'Este endereço de loja já está em uso.' }, { status: 409 })

    let tenantUserId = googleUserId
    if (!useGoogle) {
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password: String(password),
        email_confirm: true,
        user_metadata: { nome, categoria, telefone, estado, cidade, endereco, numero, nome_responsavel, cpf },
      })
      if (authError || !authData.user) throw authError || new Error('Não foi possível criar o usuário')
      createdUserId = authData.user.id
      tenantUserId = createdUserId
    }
    if (!tenantUserId) throw new Error('Não foi possível identificar sua conta.')


    const { data: tenant, error: tenantError } = await admin.from('tenants').insert({
      id: tenantUserId, slug, nome, email: normalizedEmail,
      categoria: categoria || 'Outros', telefone: telefone || null, estado: estado || null,
      cidade: cidade || null, endereco: endereco || null, numero: numero || null,
      nome_responsavel: nome_responsavel || null, cpf: cpf || null,
      status: 'pending_approval', status_pagamento: 'pendente',
    }).select().single()
    if (tenantError) throw tenantError
    if (useGoogle) googleTenantId = tenantUserId

    const { error: memberError } = await admin.from('usuarios_loja').insert({
      tenant_id: tenantUserId, user_id: tenantUserId, role: 'owner',
      nome: String(nome_responsavel || nome).slice(0, 160), email: normalizedEmail, ativo: true,
    })
    if (memberError) throw memberError

    if (referral_code) {
      const { data: embaixador } = await admin.from('embaixadores').select('*').ilike('codigo', String(referral_code)).eq('ativo', true).maybeSingle()
      if (embaixador) {
        const valorComissao = embaixador.tipo_comissao === 'fixa' ? Number(embaixador.comissao_fixa || 0) : 0
        await admin.from('indicacoes_embaixador').insert({ tenant_id: embaixador.tenant_id, embaixador_id: embaixador.id, tenant_indicado_id: tenantUserId, nome_indicado: tenant.nome, email_indicado: tenant.email, status: 'convertida', valor_comissao: valorComissao, status_comissao: 'pendente' })
      }
    }
    const response = NextResponse.json({ tenant }, { status: 201 })
    if (useGoogle) {
      response.cookies.set('wd_active_tenant', tenantUserId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 })
      response.cookies.set('wd_employee_role', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
    }
    return response
  } catch (error: any) {
    if (googleTenantId) {
      // Roll back only the newly-created store. Never delete an existing Google account.
      try { await getAdminClient().from('tenants').delete().eq('id', googleTenantId) } catch { /* best effort */ }
    }
    if (createdUserId) {
      try { await getAdminClient().auth.admin.deleteUser(createdUserId) } catch { /* limpeza best-effort */ }
    }
    console.error('Erro ao criar tenant:', error)
    return NextResponse.json({ error: error.message || 'Erro ao enviar cadastro para análise' }, { status: 500 })
  }
}
