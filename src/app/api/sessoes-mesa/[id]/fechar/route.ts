import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SALES_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

export const dynamic = 'force-dynamic'

// O fechamento e todos os lancamentos financeiros acontecem na mesma transacao do banco.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedTenant(SALES_ROLES)
  const authStatus = tenantAuthStatus(auth)
  if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão' }, { status: authStatus })
  const { tenantId } = auth
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || !['dinheiro', 'pix', 'cartao_credito', 'cartao_debito'].includes(body.forma_pagamento)) {
    return NextResponse.json({ error: 'Selecione uma forma de pagamento válida' }, { status: 400 })
  }
  const valorEntregue = body.forma_pagamento === 'dinheiro' && body.valor_pago != null ? Number(body.valor_pago) : null
  if (valorEntregue !== null && (!Number.isFinite(valorEntregue) || valorEntregue < 0)) {
    return NextResponse.json({ error: 'Valor entregue inválido' }, { status: 400 })
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await admin.rpc('fechar_sessao_mesa_financeiro', {
    p_tenant_id: tenantId, p_sessao_id: id,
    p_forma_pagamento: body.forma_pagamento, p_valor_entregue: valorEntregue,
  })
  if (error) {
    console.error('[fechar-mesa] transacao rejeitada:', error)
    return NextResponse.json({ error: error.message || 'Não foi possível fechar a mesa' }, { status: 409 })
  }
  return NextResponse.json(data)
}
