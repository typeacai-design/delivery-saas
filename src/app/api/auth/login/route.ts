import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type SessionCookie = { name: string; value: string; options?: Record<string, unknown> }

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) return NextResponse.json({ error: 'Email e senha obrigatorios' }, { status: 400 })

    const sessionCookies: SessionCookie[] = []
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => sessionCookies.push({ name, value, options })),
        },
      },
    )
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) return NextResponse.json({ error: error?.message || 'Login falhou' }, { status: 401 })

    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data: memberships } = await admin
      .from('usuarios_loja')
      .select('tenant_id, role, ativo')
      .eq('user_id', data.user.id)
      .eq('ativo', true)
    const ordered = [...(memberships || [])].sort((a, b) =>
      ((a.role === 'owner' ? 0 : 1) - (b.role === 'owner' ? 0 : 1)) || a.tenant_id.localeCompare(b.tenant_id),
    )
    const membership = ordered[0]
    if (!membership) return NextResponse.json({ error: 'Nenhuma loja ativa vinculada a este acesso.' }, { status: 403 })

    const { data: tenant } = await admin
      .from('tenants')
      .select('id, nome, status')
      .eq('id', membership.tenant_id)
      .maybeSingle()
    if (!tenant) return NextResponse.json({ error: 'Loja nao encontrada. Contate o suporte.' }, { status: 403 })
    if (!['active', 'pending_approval'].includes(tenant.status)) return NextResponse.json({ error: 'Acesso da loja suspenso ou inativo.' }, { status: 403 })

    const response = NextResponse.json({ success: true, userId: data.user.id, tenant, role: membership.role })
    for (const cookie of sessionCookies) {
      response.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof response.cookies.set>[2])
    }
    response.cookies.set('wd_active_tenant', membership.tenant_id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    return response
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro de conexao'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}