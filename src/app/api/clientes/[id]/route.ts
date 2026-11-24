import { NextResponse } from 'next/server'
import { brasiliaDay } from '@/lib/brasilia'
import { formatarNomeProprio } from '@/lib/nome-proprio'
import { SALES_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

function validBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= brasiliaDay()
}

/**
 * Edits the customer's registration data (Marketing > Meus clientes).
 * Orders keep their own snapshot of name/phone/address, so finished orders are never changed here.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedTenant(SALES_ROLES)
  const status = tenantAuthStatus(auth)
  if (status) return respond({ error: status === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, status)
  const { supabase, tenantId } = auth
  const { id } = await params

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return respond({ error: 'Dados inválidos' }, 400) }

  const nome = formatarNomeProprio(body.nome).slice(0, 160)
  const telefone = String(body.telefone ?? '').replace(/\D/g, '').slice(0, 15)
  const endereco = String(body.endereco ?? '').trim().slice(0, 500)
  const bairro = String(body.bairro ?? '').trim().slice(0, 120)
  const dataNascimento = String(body.data_nascimento ?? '').trim()

  if (!nome) return respond({ error: 'Informe o nome do cliente' }, 400)
  if (telefone.length < 10) return respond({ error: 'Informe um telefone com DDD' }, 400)
  if (dataNascimento && !validBirthDate(dataNascimento)) return respond({ error: 'Data de aniversário inválida' }, 400)

  const { data: atual } = await supabase.from('clientes').select('id').eq('id', id).eq('tenant_id', tenantId).eq('ativo', true).maybeSingle()
  if (!atual) return respond({ error: 'Cliente não encontrado' }, 404)

  // Phone identifies the customer at checkout: never let two active customers share it.
  const { data: conflito } = await supabase.from('clientes').select('id').eq('tenant_id', tenantId).eq('ativo', true).eq('telefone', telefone).neq('id', id).limit(1)
  if (conflito?.length) return respond({ error: 'Já existe outro cliente com este telefone' }, 409)

  const { data, error } = await supabase.from('clientes')
    .update({ nome, telefone, endereco: endereco || null, bairro: bairro || null, data_nascimento: dataNascimento || null })
    .eq('id', id).eq('tenant_id', tenantId)
    .select('id, nome, telefone, endereco, bairro, data_nascimento')
    .single()
  if (error) { console.error('cliente_update_failed', error.code); return respond({ error: 'Não foi possível salvar o cliente' }, 500) }
  return respond({ cliente: data })
}
