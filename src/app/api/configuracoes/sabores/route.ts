import { NextResponse } from 'next/server'
import { authenticatedTenant, MANAGEMENT_ROLES, SALES_ROLES, tenantAuthStatus } from '@/lib/tenant-auth'

export async function GET() {
  const auth = await authenticatedTenant(SALES_ROLES)
  const status = tenantAuthStatus(auth)
  if (status) return NextResponse.json({ error: 'Sem permissao' }, { status })
  const [{ data: tenant, error }, { data: products, error: productsError }] = await Promise.all([
    auth.supabase.from('tenants').select('sabores_ativo').eq('id', auth.tenantId!).single(),
    auth.supabase.from('produtos').select('id,nome').eq('tenant_id', auth.tenantId!).not('sabores_grupo_id', 'is', null),
  ])
  if (error || productsError) return NextResponse.json({ error: 'Nao foi possivel carregar a configuracao de sabores.' }, { status: 500 })
  return NextResponse.json({ sabores_ativo: tenant.sabores_ativo === true, produtos: products || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(request: Request) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const status = tenantAuthStatus(auth)
  if (status) return NextResponse.json({ error: 'Sem permissao' }, { status })
  const body = await request.json()
  if (typeof body.sabores_ativo !== 'boolean') return NextResponse.json({ error: 'Configuracao invalida.' }, { status: 400 })
  const { error } = await auth.supabase.from('tenants').update({ sabores_ativo: body.sabores_ativo }).eq('id', auth.tenantId!)
  if (error) return NextResponse.json({ error: 'Nao foi possivel salvar a configuracao de sabores.' }, { status: 400 })
  return NextResponse.json({ sabores_ativo: body.sabores_ativo })
}
