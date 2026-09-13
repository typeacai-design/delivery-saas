import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// GET - Verifica estado atual da loja
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    const { data: estado } = await admin.rpc('verificar_loja_aberta', { p_tenant_id: tenant.id })

    if (estado && estado.length > 0) {
      return NextResponse.json({
        aberta: estado[0].aberta,
        motivo: estado[0].motivo,
        proxima_mudanca: estado[0].proxima_mudanca,
      })
    }

    return NextResponse.json({
      aberta: false,
      motivo: 'erro',
      proxima_mudanca: null,
    })
  } catch (error: any) {
    console.error('Erro ao verificar estado da loja:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Alternar estado (abrir/fechar manualmente)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    const { aberta } = await req.json()
    if (typeof aberta !== 'boolean') {
      return NextResponse.json({ error: 'Parametro "aberta" deve ser boolean' }, { status: 400 })
    }

    const { error } = await admin
      .from('tenants')
      .update({
        loja_aberta_manual: aberta,
        loja_manual_timestamp: new Date().toISOString(),
      })
      .eq('id', tenant.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: estado } = await admin.rpc('verificar_loja_aberta', { p_tenant_id: tenant.id })

    return NextResponse.json({
      sucesso: true,
      aberta: estado?.[0]?.aberta || false,
      motivo: estado?.[0]?.motivo || 'erro',
      proxima_mudanca: estado?.[0]?.proxima_mudanca || null,
    })
  } catch (error: any) {
    console.error('Erro ao alterar estado da loja:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Resetar para seguir horario automatico
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    const { error } = await admin
      .from('tenants')
      .update({
        loja_aberta_manual: null,
        loja_manual_timestamp: null,
      })
      .eq('id', tenant.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: estado } = await admin.rpc('verificar_loja_aberta', { p_tenant_id: tenant.id })

    return NextResponse.json({
      sucesso: true,
      aberta: estado?.[0]?.aberta || false,
      motivo: estado?.[0]?.motivo || 'horario_programado',
      proxima_mudanca: estado?.[0]?.proxima_mudanca || null,
    })
  } catch (error: any) {
    console.error('Erro ao resetar estado da loja:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
