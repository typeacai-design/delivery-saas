import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant')
    const codigo = searchParams.get('codigo')?.toUpperCase()
    const valorPedido = parseFloat(searchParams.get('valor') || '0')

    if (!tenantId || !codigo) {
      return NextResponse.json({ valido: false, mensagem: 'Parâmetros incompletos' }, { status: 400 })
    }

    const supabase = await createClient()

    // Buscar cupom
    const { data: cupom, error } = await supabase
      .from('cupons')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('codigo', codigo)
      .eq('ativo', true)
      .single()

    if (error || !cupom) {
      return NextResponse.json({ valido: false, mensagem: 'Cupom não encontrado' })
    }

    // Verificar validade
    const agora = new Date()
    if (cupom.validade && new Date(cupom.validade) < agora) {
      return NextResponse.json({ valido: false, mensagem: 'Cupom expirado' })
    }

    // Verificar usos máximo
    if (cupom.max_usos && cupom.usos_atuais >= cupom.max_usos) {
      return NextResponse.json({ valido: false, mensagem: 'Cupom esgotado' })
    }

    // Verificar valor mínimo
    if (cupom.valor_minimo_pedido && valorPedido < cupom.valor_minimo_pedido) {
      return NextResponse.json({
        valido: false,
        mensagem: `Pedido mínimo de ${formatCurrency(cupom.valor_minimo_pedido)}`
      })
    }

    return NextResponse.json({
      valido: true,
      tipo: cupom.tipo,
      valor: cupom.valor,
      nome: cupom.nome,
    })
  } catch (error: any) {
    console.error('Erro ao validar cupom:', error)
    return NextResponse.json({ valido: false, mensagem: 'Erro ao validar cupom' }, { status: 500 })
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
