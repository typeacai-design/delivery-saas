/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'
import { gerarBrCodePix } from '@/lib/pix/gerar-brcode'
import QRCode from 'qrcode'

export async function POST() {
  try {
    const { supabase, user, tenantId, forbidden } = await authenticatedTenant(['owner', 'manager'])
    if (!user || !tenantId) return NextResponse.json({ error: forbidden ? 'Sem permissao' : 'Nao autenticado' }, { status: forbidden ? 403 : 401 })

    // Buscar config PIX
    const { data: pixConfig } = await supabase
      .from('saas_config')
      .select('valor')
      .eq('chave', 'pix')
      .single()

    const { data: trialConfig } = await supabase
      .from('saas_config')
      .select('valor')
      .eq('chave', 'trial')
      .single()

    if (!pixConfig?.valor?.chave) {
      return NextResponse.json({ error: 'Chave PIX não configurada. Configure no painel admin.' }, { status: 400 })
    }

    const valorMensalidade = trialConfig?.valor?.valor_mensalidade || 59.90
    const txid = `WE${Date.now().toString().slice(-10)}${tenantId.slice(-4)}`.toUpperCase()

    // Gerar BR Code
    const brCode = gerarBrCodePix({
      chave: pixConfig.valor.chave,
      nomeRecebedor: pixConfig.valor.nome_recebedor || 'We Delivery',
      cidade: pixConfig.valor.cidade || 'SAO PAULO',
      valor: valorMensalidade,
      txid,
    })

    // Gerar QR Code base64
    const qrCodeBase64 = await QRCode.toDataURL(brCode, { width: 400, margin: 1 })

    // Salvar pagamento
    const { data: pagamento, error } = await supabase
      .from('pix_pagamentos')
      .insert({
        tenant_id: tenantId,
        valor: valorMensalidade,
        txid,
        br_code: brCode,
        qr_code_base64: qrCodeBase64,
        expiracao: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      pagamento_id: pagamento.id,
      br_code: brCode,
      qr_code_base64: qrCodeBase64,
      valor: valorMensalidade,
      txid,
      expiracao: pagamento.expiracao,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
