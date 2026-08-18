import { NextResponse } from 'next/server'
import { ALL_TENANT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

export async function GET() {
  try {
    const auth = await authenticatedTenant(ALL_TENANT_ROLES)
    const { supabase, user, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus || !user) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus || 401 })

    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ tickets })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatedTenant(ALL_TENANT_ROLES)
    const { supabase, user, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus || !user) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus || 401 })

    const body = await request.json()
    const { assunto, descricao, categoria, prioridade } = body

    if (!assunto || !descricao) {
      return NextResponse.json({ error: 'Assunto e descrição obrigatórios' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('tickets')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        assunto,
        descricao,
        categoria: categoria || 'duvida',
        prioridade: prioridade || 'normal',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
