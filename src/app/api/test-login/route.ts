import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }

  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha obrigatórios' }, { status: 400 })
    }

    const supabase = await createClient()

    // Testa login
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code,
      })
    }

    // Busca tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, status, nome')
      .eq('id', data.user?.id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
      tenant: tenant,
      tenantError: tenantError?.message || null,
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 })
  }
}
