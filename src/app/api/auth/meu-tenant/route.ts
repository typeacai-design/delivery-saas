import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// GET /api/auth/meu-tenant — Retorna os dados do tenant do usuário logado
// Usa service_role para bypass de RLS, identificando o tenant via session do Supabase
export async function GET() {
  try {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verifica autenticação via cookie/header
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // Busca o membership
    const { data: member } = await admin
      .from('usuarios_loja')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .maybeSingle()

    if (!member) return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })

    // Busca TODOS os dados do tenant (sem restrição de RLS)
    const { data: tenant, error } = await admin
      .from('tenants')
      .select('*')
      .eq('id', member.tenant_id)
      .single()

    if (error) throw error

    return NextResponse.json(tenant)
  } catch (error: any) {
    console.error('Erro em /api/auth/meu-tenant:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}