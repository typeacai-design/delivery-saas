import { NextRequest, NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'

const DESIGN_KEYS = [
  'cardapio_layout', 'cardapio_paleta', 'cardapio_cores', 'cardapio_tipografia',
  'cardapio_whatsapp_ativo', 'cardapio_whatsapp_numero', 'cardapio_whatsapp_mensagem',
  'cardapio_aviso_ativo', 'cardapio_aviso_mensagem', 'cardapio_aviso_textos',
  'cardapio_aviso_animacao', 'cardapio_aviso_velocidade', 'cardapio_aviso_fundo',
  'cardapio_aviso_texto', 'cardapio_aviso_link', 'cardapio_segunda_faixa_ativa',
  'cardapio_segunda_faixa_mensagem', 'cardapio_segunda_faixa_link',
] as const

async function getAuth() { return authenticatedTenant(['owner', 'manager']) }

export async function GET() {
  const auth = await getAuth()
  if (!auth.user) return NextResponse.json({ error: 'Sessao expirada. Entre novamente.' }, { status: 401 })
  if (!auth.tenantId) return NextResponse.json({ error: 'Sem permissao para editar o design.' }, { status: 403 })
  const { data, error } = await auth.supabase.from('tenants').select('config, slug, logo_url, banner_url').eq('id', auth.tenantId).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tenant: data })
}

export async function POST(request: NextRequest) {
  const auth = await getAuth()
  if (!auth.user) return NextResponse.json({ error: 'Sessao expirada. Entre novamente.' }, { status: 401 })
  if (!auth.tenantId) return NextResponse.json({ error: 'Sem permissao para editar o design.' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const incoming = body?.config
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return NextResponse.json({ error: 'Configuracao de design invalida.' }, { status: 400 })
  const { data: current, error: readError } = await auth.supabase.from('tenants').select('config, slug').eq('id', auth.tenantId).single()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  const allowed = Object.fromEntries(DESIGN_KEYS.filter((key) => key in incoming).map((key) => [key, incoming[key]]))
  const { error } = await auth.supabase.from('tenants').update({ config: { ...((current.config || {}) as Record<string, unknown>), ...allowed } }).eq('id', auth.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, slug: current.slug })
}