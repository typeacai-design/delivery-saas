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

    const { data: pedidos, error } = await supabase
      .from('pedidos')
      .select('*, tenants(nome, slug)')
      .order('data_criacao', { ascending: false })

    if (error) throw error

    return NextResponse.json({ pedidos })
  } catch (error: any) {
    console.error('Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 })
  }
}
