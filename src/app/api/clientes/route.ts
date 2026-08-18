import { NextResponse } from 'next/server'
import { SALES_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

// GET - listar clientes do tenant
export async function GET() {
  try {
    const auth = await authenticatedTenant(SALES_ROLES)
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ clientes })
  } catch (error: any) {
    console.error('Erro ao buscar clientes:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - criar/atualizar cliente
// Usa upsert baseado no telefone para identificar o cliente
export async function POST(request: Request) {
  try {
    const auth = await authenticatedTenant(SALES_ROLES)
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    const body = await request.json()
    const { nome, telefone, data_nascimento, endereco, observacoes } = body

    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    // Limpar telefone para busca
    const telefoneLimpo = telefone?.replace(/\D/g, '') || ''

    // Verificar se cliente já existe pelo telefone
    let cliente

    if (telefoneLimpo) {
      const { data: existente } = await supabase
        .from('clientes')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('telefone', telefoneLimpo)
        .single()

      if (existente) {
        // Atualizar cliente existente
        const { data, error } = await supabase
          .from('clientes')
          .update({
            nome,
            data_nascimento: data_nascimento || null,
            endereco: endereco || null,
            observacoes: observacoes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existente.id)
          .select()
          .single()

        if (error) throw error
        cliente = data
      }
    }

    // Se não encontrou existente ou não tem telefone, criar novo
    if (!cliente) {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          tenant_id: tenantId,
          nome,
          telefone: telefoneLimpo || null,
          data_nascimento: data_nascimento || null,
          endereco: endereco || null,
          observacoes: observacoes || null,
        })
        .select()
        .single()

      if (error) throw error
      cliente = data
    }

    return NextResponse.json(cliente)
  } catch (error: any) {
    console.error('Erro ao criar/atualizar cliente:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
