import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminUnauthorizedResponse, getAdminSession } from '@/lib/admin-auth'

// POST /api/admin/fix-tenant
// Procura auth.users que NÃO tem tenant correspondente e cria o tenant com defaults.
// Útil pra consertar cadastros antigos onde o INSERT falhou silenciosamente.

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST() {
  if (!(await getAdminSession())) return adminUnauthorizedResponse()
  try {
    const supa = admin()

    // Pega todos auth.users
    const { data: authData } = await supa.auth.admin.listUsers()
    const users = authData?.users || []

    // Pega todos tenants
    const { data: tenants } = await supa
      .from('tenants')
      .select('id, email')

    const tenantIds = new Set((tenants || []).map((t) => t.id))

    const fixed: any[] = []
    const skipped: any[] = []

    for (const u of users) {
      if (tenantIds.has(u.id)) {
        skipped.push({ email: u.email, reason: 'já tem tenant' })
        continue
      }
      // Tenta criar tenant com defaults baseados no user_metadata
      const md = (u.user_metadata as any) || {}
      const nome = md.nome || u.email?.split('@')[0] || 'Minha Loja'
      const slug = (md.nome || u.email || 'loja')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      try {
        const { data, error } = await supa
          .from('tenants')
          .insert({
            id: u.id,
            slug: `${slug}-${u.id.slice(0, 6)}`,
            nome,
            email: u.email || '',
            categoria: md.categoria || 'Outros',
            telefone: md.telefone || null,
            estado: md.estado || null,
            cidade: md.cidade || null,
            endereco: md.endereco || null,
            numero: md.numero || null,
            nome_responsavel: md.nome_responsavel || null,
            cpf: md.cpf || null,
            status: 'pending_approval',
            valor_mensalidade: 99.90,
            status_pagamento: 'pendente',
          })
          .select()
          .single()

        if (error) {
          skipped.push({ email: u.email, reason: error.message })
        } else {
          fixed.push({ email: u.email, tenant_id: data.id, nome: data.nome })
        }
      } catch (e: any) {
        skipped.push({ email: u.email, reason: e.message })
      }
    }

    return NextResponse.json({ fixed, skipped, totalUsers: users.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
