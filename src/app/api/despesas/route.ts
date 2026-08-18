import { NextResponse } from 'next/server'
import { MANAGEMENT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

export async function GET() {
  try {
    const auth = await authenticatedTenant(MANAGEMENT_ROLES)
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    const { data: despesas, error } = await supabase
      .from('despesas')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('ativo', true)
      .order('dia_vencimento')

    if (error) throw error
    return NextResponse.json({ despesas })
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
    const { nome, valor, categoria, recorrencia, dia_vencimento } = body

    const { data, error } = await supabase
      .from('despesas')
      .insert({
        tenant_id: tenantId,
        nome,
        valor: parseFloat(valor) || 0,
        categoria: categoria || 'fixa',
        recorrencia: recorrencia || 'mensal',
        dia_vencimento: parseInt(dia_vencimento) || 1,
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
      .from('despesas')
      .update({ ativo: false })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
