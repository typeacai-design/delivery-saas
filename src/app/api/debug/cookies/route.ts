import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }

  // Log TODOS os cookies recebidos
  const allCookies = request.cookies.getAll()
  const cookieNames = allCookies.map(c => c.name)

  // Tenta criar client e ler sessão
  let sessionInfo: any = { error: 'não tentou' }

  try {
    const supabase = await createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    sessionInfo = {
      sessionExists: !!session,
      sessionError: sessionError?.message,
      userExists: !!user,
      userError: userError?.message,
      userEmail: user?.email,
      userId: user?.id,
    }
  } catch (err: any) {
    sessionInfo = { error: err.message }
  }

  return NextResponse.json({
    cookies: cookieNames,
    sessionInfo,
    headers: {
      host: request.headers.get('host'),
      cookie: request.headers.get('cookie') ? 'presente' : 'ausente',
    },
  })
}
