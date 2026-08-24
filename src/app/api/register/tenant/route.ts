import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  let createdUserId: string | null = null
  try {
    const body = await request.json()
    const { nome, slug, email, password, categoria, telefone, estado, cidade, endereco, numero, nome_responsavel, cpf, referral_code } = body
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!nome || !slug || !normalizedEmail || !password) {
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 })
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres' }, { status: 400 })
    }

    const admin = getAdminClient()
    const { data: existingUsers } = await admin.auth.admin.listUsers()
    if (existingUsers?.users?.some((u) => u.email?.toLowerCase() === normalizedEmail)) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.' }, { status: 409 })
    }
    const { data: existingSlug } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle()
    if (existingSlug) return NextResponse.json({ error: 'Este endereço de loja já está em uso.' }, { status: 409 })

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: String(password),
      email_confirm: true,
      user_metadata: { nome, categoria, telefone, estado, cidade, endereco, numero, nome_responsavel, cpf },
    })
    if (authError || !authData.user) throw authError || new Error('Não foi possível criar o usuário')
    createdUserId = authData.user.id

    const { data: tenant, error: tenantError } = await admin.from('tenants').insert({
      id: createdUserId, slug, nome, email: normalizedEmail,
      categoria: categoria || 'Outros', telefone: telefone || null, estado: estado || null,
      cidade: cidade || null, endereco: endereco || null, numero: numero || null,
      nome_responsavel: nome_responsavel || null, cpf: cpf || null,
      status: 'pending_approval', status_pagamento: 'pendente',
    }).select().single()
    if (tenantError) throw tenantError

    const { error: memberError } = await admin.from('usuarios_loja').insert({
      tenant_id: createdUserId, user_id: createdUserId, role: 'owner',
      nome: String(nome_responsavel || nome).slice(0, 160), email: normalizedEmail, ativo: true,
    })
    if (memberError) throw memberError

    if (referral_code) {
      const { data: embaixador } = await admin.from('embaixadores').select('*').ilike('codigo', String(referral_code)).eq('ativo', true).maybeSingle()
      if (embaixador) {
        const valorComissao = embaixador.tipo_comissao === 'fixa' ? Number(embaixador.comissao_fixa || 0) : 0
        await admin.from('indicacoes_embaixador').insert({ tenant_id: embaixador.tenant_id, embaixador_id: embaixador.id, tenant_indicado_id: createdUserId, nome_indicado: tenant.nome, email_indicado: tenant.email, status: 'convertida', valor_comissao: valorComissao, status_comissao: 'pendente' })
      }
    }
    return NextResponse.json({ tenant }, { status: 201 })
  } catch (error: any) {
    if (createdUserId) {
      try { await getAdminClient().auth.admin.deleteUser(createdUserId) } catch { /* limpeza best-effort */ }
    }
    console.error('Erro ao criar tenant:', error)
    return NextResponse.json({ error: error.message || 'Erro ao enviar cadastro para análise' }, { status: 500 })
  }
}