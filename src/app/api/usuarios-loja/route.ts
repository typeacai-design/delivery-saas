/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'node:crypto'
import { enviarEmail } from '@/lib/email/resend'

const escapeHtml=(value:string)=>value.replace(/[&<>'"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]!))

const adminClient=()=>createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

export async function GET() {
  try {
    const {supabase,user,tenantId,role}=await authenticatedTenant(['owner','manager'])
    if(!user||!tenantId)return NextResponse.json({error:'Não autorizado'},{status:403})
    const usuarioLoja={tenant_id:tenantId,role}

    // Listar usuários da mesma loja
    const { data: usuarios, error } = await supabase
      .from('usuarios_loja')
      .select('*')
      .eq('tenant_id', usuarioLoja.tenant_id)
      .order('created_at')

    if (error) throw error
    return NextResponse.json({ usuarios: (usuarios || []).filter((item: any) => ['kitchen', 'motoboy'].includes(item.role)), can_manage: usuarioLoja.role === 'owner' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const {user,tenantId,role:actorRole}=await authenticatedTenant(['owner'])
    if(!user||!tenantId)return NextResponse.json({error:'Sem permissão'},{status:403})

    const body = await request.json()
    const { email, nome, role } = body
    const rolesPermitidas = ['kitchen', 'motoboy']

    if (!email || !nome || !rolesPermitidas.includes(role)) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    const usuarioLoja={tenant_id:tenantId,role:actorRole}
    if (actorRole !== 'owner') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const authAdmin = adminClient()
    // Verifica se email já existe no Auth; caso contrário envia convite seguro.
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const { data: pending, error: pendingError } = await authAdmin.from('convites_loja').insert({ tenant_id: usuarioLoja.tenant_id, email: String(email).toLowerCase(), nome, role, token_hash: tokenHash, expires_at: new Date(Date.now()+48*60*60*1000).toISOString() }).select('id').single()
    if (pendingError) throw pendingError
    const redirectTo = `${new URL(request.url).origin}/equipe/aceitar?token=${encodeURIComponent(rawToken)}`
    const { data: newUser, error: createError } = await authAdmin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { nome } })
    if (createError || !newUser.user) {
      // Um email já cadastrado não pode receber inviteUserByEmail. Nesse caso o
      // link opaco é enviado pelo provedor transacional; o aceite ainda exige
      // sessão autenticada com exatamente o email persistido no convite.
      const safeName=escapeHtml(String(nome).slice(0,160)),safeUrl=escapeHtml(redirectTo)
      const sent=await enviarEmail({to:String(email).toLowerCase(),subject:'Convite para a equipe WeDelivery',html:`<div style="font-family:sans-serif;max-width:560px;margin:auto"><h1>Convite para a equipe</h1><p>Olá, ${safeName}. Você recebeu um convite de acesso.</p><p>Entre na sua conta WeDelivery com este mesmo email e depois abra o botão abaixo.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#16a34a;color:white;text-decoration:none;border-radius:10px">Aceitar convite</a></p><p>Este link expira em 48 horas.</p></div>`})
      if(!sent.success){await authAdmin.from('convites_loja').delete().eq('id',pending.id);return NextResponse.json({error:'Não foi possível enviar o convite seguro.'},{status:503})}
    }
    return NextResponse.json({ pending: true })

    /* vínculo criado apenas no aceite autenticado
    const userId = newUser.user.id

    // Adiciona à loja
    const { data, error } = await supabase
      .from('usuarios_loja')
      .insert({
        tenant_id: usuarioLoja.tenant_id,
        user_id: userId,
        nome,
        email,
        role,
      })
      .select()
      .single()

    if (error) throw error

    // Auditoria
    await admin.rpc('registrar_auditoria', {
      p_tenant_id: usuarioLoja.tenant_id,
      p_user_id: user.id,
      p_acao: 'convidar_usuario',
      p_tabela: 'usuarios_loja',
      p_registro_id: data.id,
      p_dados_anteriores: null,
      p_dados_novos: { email, nome, role }
    })

    return NextResponse.json(data) */
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const {user,tenantId,role:actorRole}=await authenticatedTenant(['owner'])
    if(!user||!tenantId)return NextResponse.json({error:'Sem permissão'},{status:403})

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID necessário' }, { status: 400 })

    const usuarioLoja={tenant_id:tenantId,role:actorRole}
    if (actorRole !== 'owner') {
      return NextResponse.json({ error: 'Apenas owner pode remover' }, { status: 403 })
    }

    // Não permite remover a si mesmo
    const admin = adminClient()
    const { data: target } = await admin
      .from('usuarios_loja')
      .select('user_id, role')
      .eq('id', id)
      .eq('tenant_id', usuarioLoja.tenant_id)
      .single()

    if (target?.user_id === user.id) {
      return NextResponse.json({ error: 'Você não pode remover a si mesmo' }, { status: 400 })
    }
    if (!target || !['kitchen', 'motoboy'].includes(target.role)) return NextResponse.json({ error: 'Acesso não permitido' }, { status: 403 })

    // Exclui apenas o vínculo de acesso à loja; a conta Auth não é apagada.
    const { error } = await admin
      .from('usuarios_loja')
      .delete()
      .eq('id', id)
      .eq('tenant_id', usuarioLoja.tenant_id)

    if (error) throw error

    // Auditoria
    await admin.rpc('registrar_auditoria', {
      p_tenant_id: usuarioLoja.tenant_id,
      p_user_id: user.id,
      p_acao: 'remover_usuario',
      p_tabela: 'usuarios_loja',
      p_registro_id: id,
      p_dados_anteriores: { ativo: true },
      p_dados_novos: { acesso_removido: true }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const {user,tenantId,role:actorRole}=await authenticatedTenant(['owner'])
    if(!user||!tenantId)return NextResponse.json({error:'Sem permissão'},{status:403})
    const body = await request.json(); const { id, nome, email, role, ativo } = body
    if (!id || !['kitchen', 'motoboy'].includes(role) || typeof ativo !== 'boolean') return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    const actor={tenant_id:tenantId,role:actorRole}
    if (!actor || actor.role !== 'owner') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const admin = adminClient()
    const { data: target } = await admin.from('usuarios_loja').select('id,role,email').eq('id', id).eq('tenant_id', actor.tenant_id).single()
    if (!target || !['kitchen', 'motoboy'].includes(target.role)) return NextResponse.json({ error: 'Acesso não permitido' }, { status: 403 })
    if (email && String(email).toLowerCase() !== String(target.email || '').toLowerCase()) return NextResponse.json({ error: 'O email não pode ser alterado. Exclua o acesso e envie um novo convite.' }, { status: 400 })
    const { data, error } = await admin.from('usuarios_loja').update({ nome: String(nome || '').slice(0, 160), role, ativo }).eq('id', id).eq('tenant_id', actor.tenant_id).select().single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }) }
}
