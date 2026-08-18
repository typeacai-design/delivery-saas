import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { MANAGEMENT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

// POST /api/revalidate-cardapio
// Body: { slug: string }
// Invalida o cache do cardápio público para o slug
export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json()
    if (!slug) {
      return NextResponse.json({ error: 'slug obrigatório' }, { status: 400 })
    }

    // Validação rápida de segurança: existe mesmo esse slug?
    const auth = await authenticatedTenant(MANAGEMENT_ROLES)
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, slug')
      .eq('slug', slug)
      .eq('id', tenantId)
      .single()

    if (!tenant) {
      return NextResponse.json({ error: 'slug não encontrado' }, { status: 404 })
    }

    // Revalida com layout
    revalidatePath(`/cardapio/${slug}`)
    revalidatePath(`/cardapio/${slug}`, 'layout')

    return NextResponse.json({ ok: true, slug })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
