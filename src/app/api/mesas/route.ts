import { NextResponse } from 'next/server'
import { MANAGEMENT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

export async function GET() {
  try {
    const auth = await authenticatedTenant(MANAGEMENT_ROLES)
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    // Traz ativas e inativas para permitir reativar via UI
    const { data: mesas, error } = await supabase
      .from('mesas')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('numero')

    if (error) throw error
    return NextResponse.json({ mesas })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatedTenant(MANAGEMENT_ROLES)
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    const body = await request.json()
    const { numero, nome, capacidade, ativo } = body

    const { data, error } = await supabase
      .from('mesas')
      .insert({
        tenant_id: tenantId,
        numero,
        nome: nome || `Mesa ${numero}`,
        capacidade: parseInt(capacidade) || 4,
        ativa: ativo !== false,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authenticatedTenant(MANAGEMENT_ROLES)
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID da mesa é obrigatório' }, { status: 400 })

    const body = await request.json()
    const update: Record<string, any> = {}
    if (body.numero !== undefined) update.numero = parseInt(body.numero, 10)
    if (body.nome !== undefined) update.nome = body.nome || `Mesa ${update.numero || body.numero}`
    if (body.capacidade !== undefined) update.capacidade = parseInt(body.capacidade, 10) || 4
    if (body.ativo !== undefined) update.ativa = body.ativo !== false

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('mesas')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authenticatedTenant(MANAGEMENT_ROLES)
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    const { error } = await supabase
      .from('mesas')
      .update({ ativa: false })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
