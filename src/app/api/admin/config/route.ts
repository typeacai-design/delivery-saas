import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminUnauthorizedResponse, getAdminSession } from '@/lib/admin-auth'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const PUBLIC_CONFIG_FIELDS = [
  'valorMensalidade', 'valorMinimo', 'emailCobranca', 'nomeAdmin', 'emailAdmin',
  'termosUso', 'politicaPrivacidade', 'notificarVencimento',
  'notificarNovoCadastro', 'notificarInadimplencia',
] as const

function safeConfig(value: unknown) {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return Object.fromEntries(PUBLIC_CONFIG_FIELDS.filter(key => key in source).map(key => [key, source[key]]))
}

// GET /api/admin/config — retorna a config do sistema (linha 'admin' em saas_config)
export async function GET() {
  if (!(await getAdminSession())) return adminUnauthorizedResponse()
  const supa = admin()
  const { data, error } = await supa
    .from('saas_config')
    .select('valor')
    .eq('chave', 'admin')
    .single()

  if (error && error.code === 'PGRST116') {
    // Não existe ainda — retorna defaults
    return NextResponse.json({ valor: null })
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ valor: safeConfig(data?.valor) }, { headers: { 'Cache-Control': 'no-store' } })
}

// PUT /api/admin/config — salva config (mescla com existente)
export async function PUT(request: Request) {
  if (!(await getAdminSession())) return adminUnauthorizedResponse()
  const body = safeConfig(await request.json())
  const supa = admin()

  // Carrega existente
  const { data: existing } = await supa
    .from('saas_config')
    .select('valor')
    .eq('chave', 'admin')
    .single()

  const merged = { ...(existing?.valor || {}), ...body }

  const { error } = await supa
    .from('saas_config')
    .upsert({ chave: 'admin', valor: merged, atualizado_em: new Date().toISOString() })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, valor: safeConfig(merged) })
}
