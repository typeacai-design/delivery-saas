import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { token } = await request.json(); if (!token || String(token).length < 32) return NextResponse.json({ error: 'Convite inválido' }, { status: 400 })
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Faça login com o email convidado' }, { status: 401 })
  const hash = createHash('sha256').update(String(token)).digest('hex')
  const { data, error } = await supabase.rpc('aceitar_convite_loja', { p_token_hash: hash })
  return error ? NextResponse.json({ error: 'Convite inválido, expirado ou destinado a outro email' }, { status: 403 }) : NextResponse.json(data)
}
