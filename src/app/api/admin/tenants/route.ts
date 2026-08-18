import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminUnauthorizedResponse, getAdminSession } from '@/lib/admin-auth'

// Cliente admin com service_role que ignora RLS
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  )
}

export async function GET() {
  if (!(await getAdminSession())) return adminUnauthorizedResponse()
  try {
    const supabase = getAdminClient()

    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ tenants })
  } catch (error: any) {
    console.error('Erro ao buscar tenants:', error)
    return NextResponse.json({ error: error.message || 'Erro ao buscar lojistas' }, { status: 500 })
  }
}

// Criar lojista — cria usuário no Auth + insere tenant
// Fluxo: status = 'pending_approval' (sem confirmação de email necessária)
// Admin aprova → muda pra 'active'
export async function POST(request: Request) {
  if (!(await getAdminSession())) return adminUnauthorizedResponse()
  try {
    const supabase = getAdminClient()
    const body = await request.json()

    const {
      nome, slug, email, password,
      categoria, telefone, estado, cidade, endereco, numero,
      nome_responsavel, cpf,
      valor_mensalidade,
    } = body

    if (!nome || !email || !password) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Slug: se não veio, gera a partir do nome
    const finalSlug = (slug || nome)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Verificar se email já existe
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    if (existingUsers?.users?.some((u) => u.email?.toLowerCase() === email.toLowerCase())) {
      return NextResponse.json({ error: 'Este email já está cadastrado' }, { status: 400 })
    }

    // Verificar slug duplicado
    const { data: existingSlug } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', finalSlug)
      .single()

    if (existingSlug) {
      return NextResponse.json({ error: 'Slug já está em uso' }, { status: 400 })
    }

    // Endereço completo com número
    const enderecoCompleto = numero ? `${endereco}, ${numero}` : endereco

    // 1. Criar usuário no Auth —” email_confirm: true (sem link de confirmação)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Admin cria → já confirmado
      user_metadata: {
        nome,
        categoria,
        telefone,
        estado,
        cidade,
        endereco: enderecoCompleto,
        numero,
        nome_responsavel,
        cpf,
      },
    })

    if (authError) throw authError

    const userId = authData.user.id

    // 2. Criar tenant com status 'pending_approval'
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        id: userId,
        slug: finalSlug,
        nome,
        email,
        categoria,
        telefone,
        estado,
        cidade,
        endereco: enderecoCompleto,
        numero,
        nome_responsavel,
        cpf,
        status: 'pending_approval',
        valor_mensalidade: Number(valor_mensalidade) || 99.90,
        status_pagamento: 'pendente',
      })
      .select()
      .single()

    if (tenantError) throw tenantError

    return NextResponse.json({ tenant })
  } catch (error: any) {
    console.error('Erro ao criar tenant:', error)
    return NextResponse.json({ error: error.message || 'Erro ao criar lojista' }, { status: 500 })
  }
}

// Atualizar lojista —” qualquer campo editável + status de aprovação
export async function PUT(request: Request) {
  if (!(await getAdminSession())) return adminUnauthorizedResponse()
  try {
    const supabase = getAdminClient()
    const body = await request.json()

    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'ID necessário' }, { status: 400 })
    }

    // Se a senha veio pra atualizar, atualizar via admin API
    if (updates.password) {
      const { error: pwError } = await supabase.auth.admin.updateUserById(id, {
        password: updates.password,
      })
      if (pwError) throw pwError
      delete updates.password
    }

    // Se o email veio pra atualizar
    if (updates.email) {
      const { error: emailError } = await supabase.auth.admin.updateUserById(id, {
        email: updates.email,
      })
      if (emailError) throw emailError
      delete updates.email
    }

    // Atualizar tenant
    const { data, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ tenant: data })
  } catch (error: any) {
    console.error('Erro ao atualizar tenant:', error)
    return NextResponse.json({ error: error.message || 'Erro ao atualizar lojista' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!(await getAdminSession())) return adminUnauthorizedResponse()
  try {
    const supabase = getAdminClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID necessário' }, { status: 400 })
    }

    // Deletar usuário do Auth (cascade no tenant)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(id)
    if (deleteError) {
      return NextResponse.json(
        { error: 'Não foi possível excluir este lojista. Ele pode possuir dados relacionados; suspenda-o ou solicite uma exclusão assistida.', detail: deleteError.message },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao deletar tenant:', error)
    return NextResponse.json({ error: error.message || 'Erro ao deletar lojista' }, { status: 500 })
  }
}
