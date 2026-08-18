import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminUnauthorizedResponse, getAdminSession } from '@/lib/admin-auth'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  if (!(await getAdminSession())) return adminUnauthorizedResponse()
  try {
    const supabase = getAdminClient()

    const { data: pagamentos, error } = await supabase
      .from('pagamentos')
      .select('*, tenants(nome, slug)')
      .order('data_pagamento', { ascending: false })

    if (error) throw error

    return NextResponse.json({ pagamentos })
  } catch (error: any) {
    console.error('Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) return adminUnauthorizedResponse()
  try {
    const supabase = getAdminClient()
    const body = await request.json()

    const { tenant_id, valor, data_pagamento, observacoes } = body

    if (!tenant_id || !valor) {
      return NextResponse.json({ error: 'tenant_id e valor são obrigatórios' }, { status: 400 })
    }

    const dataPgto = data_pagamento || new Date().toISOString().split('T')[0]
    const mesRef = dataPgto.slice(0, 7) // YYYY-MM

    const { data, error } = await supabase
      .from('pagamentos')
      .insert({
        tenant_id,
        valor: Number(valor),
        data_pagamento: dataPgto,
        mes_referencia: mesRef,
        status: 'pago',
        observacoes: observacoes || null
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ pagamento: data })
  } catch (error: any) {
    console.error('Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 })
  }
}
