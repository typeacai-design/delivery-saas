import { NextResponse } from 'next/server'
import { MANAGEMENT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

export async function GET() {
  try {
    const auth = await authenticatedTenant(MANAGEMENT_ROLES)
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    const { data: turnos, error } = await supabase
      .from('turnos_capacidade')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('ativo', true)
      .order('hora_inicio')

    if (error) throw error
    return NextResponse.json({ turnos })
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
    const { nome, dias_semana, hora_inicio, hora_fim, capacidade_maxima } = body

    const { data, error } = await supabase
      .from('turnos_capacidade')
      .insert({
        tenant_id: tenantId,
        nome,
        dias_semana,
        hora_inicio,
        hora_fim,
        capacidade_maxima: parseInt(capacidade_maxima) || 10,
      })
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
      .from('turnos_capacidade')
      .update({ ativo: false })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
