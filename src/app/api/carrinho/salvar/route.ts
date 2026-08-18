import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { tenant_id, session_id, itens, cliente_nome, cliente_whatsapp, valor_total } = body

    if (!tenant_id || !session_id) {
      return NextResponse.json({ error: 'tenant_id e session_id obrigatórios' }, { status: 400 })
    }

    // Upsert: atualiza se já existe, senão cria
    const { data: existente } = await supabase
      .from('carrinho_abandonado')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('session_id', session_id)
      .single()

    if (existente) {
      const { error } = await supabase
        .from('carrinho_abandonado')
        .update({
          itens,
          cliente_nome,
          cliente_whatsapp,
          valor_total,
          ultimo_acesso: new Date().toISOString(),
        })
        .eq('id', existente.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('carrinho_abandonado')
        .insert({
          tenant_id,
          session_id,
          itens,
          cliente_nome,
          cliente_whatsapp,
          valor_total,
        })

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
