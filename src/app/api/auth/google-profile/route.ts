import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasGoogleIdentity } from '@/lib/google-auth'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !hasGoogleIdentity(user)) return NextResponse.json({ error: 'Entre com Google para continuar.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({ email: user!.email, nome: String(user!.user_metadata?.full_name || '').slice(0, 160) }, { headers: { 'Cache-Control': 'no-store' } })
}

