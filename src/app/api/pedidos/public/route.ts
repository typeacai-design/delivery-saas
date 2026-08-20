import { NextResponse as NextResponseBase } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { bearerToken, hashAccessToken, isValidCpf, normalizeCpf, rateLimited, tokenMatches } from '@/lib/customer-identity'

const NextResponse = {
  json(body: unknown, init: ResponseInit = {}) {
    const headers = new Headers(init.headers); headers.set('Cache-Control', 'no-store')
    return NextResponseBase.json(body, { ...init, headers })
  },
}

// POST /api/pedidos/public — usado pelo cliente final no checkout.
// NÃO exige login (cliente é anônimo). Usa service_role pra inserir
// contornando RLS, mas valida previamente:
//   1. tenant existe e está com status='active'
//   2. loja está no horário de funcionamento
//   3. valor mínimo do pedido é respeitado

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date <= new Date()
}

export async function GET(request: Request) {
  try {
    const admin = getAdminClient()
    if (await rateLimited(admin, request, 'customer-orders-read')) return NextResponse.json({ error: 'Não foi possível consultar os pedidos' }, { status: 429, headers: { 'Cache-Control': 'no-store' } })
    const url = new URL(request.url); const slug = url.searchParams.get('tenant_slug'); const token = bearerToken(request)
    if (!slug || token.length < 32) return NextResponse.json({ error: 'Não foi possível consultar os pedidos' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    const { data: tenant } = await admin.from('tenants').select('id').eq('slug', slug).single()
    if (!tenant) return NextResponse.json({ error: 'Não foi possível consultar os pedidos' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    const hash = hashAccessToken(token)
    const { data, error } = await admin.from('pedidos').select('id,codigo,status,created_at,valor_total,tipo_entrega,forma_pagamento,pedido_itens(nome,quantidade,valor_unitario,variante_nome,complementos)').eq('tenant_id', tenant.id).eq('cliente_acesso_token_hash', hash).order('created_at', { ascending: false }).limit(50)
    if (error) throw error
    return NextResponse.json({ pedidos: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: 'Não foi possível consultar os pedidos' }, { status: 500, headers: { 'Cache-Control': 'no-store' } }) }
}

function checkHorarioAberto(horarios: any): { aberto: boolean; motivo?: string } {
  if (!horarios) return { aberto: true }
  const now = new Date()
  // Ajuste para timezone do Brasil (UTC-3)
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
  const diaId = dias[br.getUTCDay()]
  const h = horarios[diaId]
  if (!h || !h.ativo) {
    return { aberto: false, motivo: 'loja fechada hoje' }
  }
  const [ha, ma] = h.abre.split(':').map(Number)
  const [hf, mf] = h.fecha.split(':').map(Number)
  const minutos = br.getUTCHours() * 60 + br.getUTCMinutes()
  const minAbre = ha * 60 + ma
  let minFecha = hf * 60 + mf
  // Se fecha é meia-noite (00:00), considera como 24h
  if (hf === 0 && mf === 0) minFecha = 24 * 60
  if (minutos < minAbre || minutos > minFecha) {
    return { aberto: false, motivo: `fora do horário (${h.abre} às ${h.fecha})` }
  }
  return { aberto: true }
}

export async function POST(request: Request) {
  try {
    const admin = getAdminClient()
    if (await rateLimited(admin, request, 'customer-order-write', 12)) return NextResponse.json({ error: 'Não foi possível processar a solicitação' }, { status: 429, headers: { 'Cache-Control': 'no-store' } })
    const body = await request.json()
    const {
      tenant_slug,
      cliente_nome,
      cliente_whatsapp,
      itens,
      valor_subtotal,
      taxa_entrega,
      valor_desconto,
      valor_total,
      forma_pagamento,
      troco_para,
      bairro_entrega,
      taxa_bairro,
      observacoes,
      cupom_aplicado,
      endereco_entrega,
      numero_entrega,
      complemento_entrega,
      tipo_entrega = 'delivery',
      cliente_aniversario,
      cliente_cpf,
      cliente_access_token,
      cliente_latitude,
      cliente_longitude,
    } = body

    if (!tenant_slug) {
      return NextResponse.json({ error: 'Loja não identificada' }, { status: 400 })
    }
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ error: 'Pedido sem itens' }, { status: 400 })
    }
    if (!cliente_nome || !cliente_whatsapp) {
      return NextResponse.json({ error: 'Nome e WhatsApp são obrigatórios' }, { status: 400 })
    }
    if (!isValidCpf(cliente_cpf)) return NextResponse.json({ error: 'CPF inválido' }, { status: 400 })

    // 1) Valida tenant
    const { data: tenant, error: tenantErr } = await admin
      .from('tenants')
      .select('id, status, config, slug, latitude, longitude')
      .eq('slug', tenant_slug)
      .single()

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
    }
    if (tenant.status !== 'active') {
      return NextResponse.json({ error: 'Loja não está ativa' }, { status: 403 })
    }

    // 2) Verifica loja aberta
    const cfg = (tenant.config || {}) as any
    if (cfg.loja_aberta === false) {
      return NextResponse.json({ error: 'Loja está fechada no momento' }, { status: 403 })
    }
    const horario = checkHorarioAberto(cfg.horarios_dias)
    if (!horario.aberto) {
      return NextResponse.json({ error: `Loja fechada — ${horario.motivo}` }, { status: 403 })
    }

    // 3) Valor mínimo
    // Reconstroi precos e vinculos no servidor; valores do navegador nao sao confiaveis.
    const produtoIdsValidacao = [...new Set(itens.map((i: any) => i.produto_id).filter(Boolean))] as string[]
    const { data: produtosDb } = await admin.from('produtos').select('id,nome,preco,ativo').eq('tenant_id', tenant.id).in('id', produtoIdsValidacao)
    if (!produtosDb || produtosDb.length !== produtoIdsValidacao.length || produtosDb.some((p: any) => !p.ativo)) return NextResponse.json({ error: 'Produto indisponivel' }, { status: 400 })
    const varianteIds = itens.map((i: any) => i.variante_id).filter(Boolean)
    const complementoIds = itens.flatMap((i: any) => (i.complementos || []).map((c: any) => c.id)).filter(Boolean)
    const [{ data: variantesDb }, { data: complementosDb }, { data: vinculosDb }, { data: listasDb }] = await Promise.all([
      varianteIds.length ? admin.from('variantes').select('id,produto_id,nome,preco_adicional').in('id', varianteIds) : Promise.resolve({ data: [] }),
      complementoIds.length ? admin.from('complementos').select('id,nome,preco,ativo,categoria_id,qtd_max,controlar_estoque,quantidade_estoque').eq('tenant_id', tenant.id).in('id', complementoIds) : Promise.resolve({ data: [] }),
      admin.from('produto_complementos').select('produto_id,complemento_id').in('produto_id', produtoIdsValidacao),
      admin.from('categorias_complementos').select('id,qtd_minima,qtd_maxima,max_selecoes,obrigatorio').eq('tenant_id', tenant.id).eq('ativo', true),
    ])
    const todosComplementoIds = (vinculosDb || []).map((v: any) => v.complemento_id)
    const { data: categoriasDosComplementos } = todosComplementoIds.length
      ? await admin.from('complementos').select('id,categoria_id').in('id', todosComplementoIds)
      : { data: [] as any[] }
    const produtosMap = new Map((produtosDb || []).map((p: any) => [p.id, p]))
    const variantesMap = new Map((variantesDb || []).map((v: any) => [v.id, v]))
    const compsMap = new Map((complementosDb || []).map((c: any) => [c.id, c]))
    const vinculos = new Set((vinculosDb || []).map((v: any) => `${v.produto_id}:${v.complemento_id}`))
    const categoriaPorComp = new Map((categoriasDosComplementos || []).map((c: any) => [c.id, c.categoria_id]))
    const venderSemEstoque = cfg.entrega_km?.vender_sem_estoque === true
    const listasMap = new Map((listasDb || []).map((l: any) => [l.id, l]))

    const itensValidados: any[] = []
    let subtotalCalculado = 0
    for (const item of itens) {
      const produto: any = produtosMap.get(item.produto_id)
      const quantidade = Math.max(1, Math.min(99, Number(item.quantidade) || 1))
      const variante: any = item.variante_id ? variantesMap.get(item.variante_id) : null
      if (item.variante_id && (!variante || variante.produto_id !== produto.id)) return NextResponse.json({ error: 'Variacao invalida' }, { status: 400 })
      const selecionados: any[] = []
      const qtdPorLista = new Map<string, number>()
      for (const escolhido of (item.complementos || [])) {
        const comp: any = compsMap.get(escolhido.id)
        if (!comp || !comp.ativo || !vinculos.has(`${produto.id}:${comp.id}`)) return NextResponse.json({ error: 'Complemento invalido' }, { status: 400 })
        const qtd = Number(escolhido.quantidade) || 0
        if (qtd < 0 || qtd > Number(comp.qtd_max || 99)) return NextResponse.json({ error: `Quantidade invalida de ${comp.nome}` }, { status: 400 })
        if (!venderSemEstoque && comp.controlar_estoque && qtd * quantidade > Number(comp.quantidade_estoque || 0)) return NextResponse.json({ error: `${comp.nome} sem estoque suficiente` }, { status: 400 })
        selecionados.push({ id: comp.id, nome: comp.nome, quantidade: qtd, valor: Number(comp.preco) })
        if (comp.categoria_id) qtdPorLista.set(comp.categoria_id, (qtdPorLista.get(comp.categoria_id) || 0) + qtd)
      }
      const listasDoProduto = new Set((vinculosDb || []).filter((v: any) => v.produto_id === produto.id).map((v: any) => categoriaPorComp.get(v.complemento_id)).filter(Boolean))
      for (const listaId of listasDoProduto) {
        const lista: any = listasMap.get(listaId)
        const qtd = qtdPorLista.get(listaId as string) || 0
        const minimo = Number(lista?.qtd_minima ?? (lista?.obrigatorio ? 1 : 0))
        const maximo = Number(lista?.qtd_maxima ?? lista?.max_selecoes ?? 99)
        if (qtd < minimo || qtd > maximo) return NextResponse.json({ error: 'Complementos fora dos limites da lista' }, { status: 400 })
      }
      const adicional = selecionados.reduce((s, c) => s + c.valor * c.quantidade, 0)
      subtotalCalculado += (Number(produto.preco) + Number(variante?.preco_adicional || 0) + adicional) * quantidade
      itensValidados.push({ produto_id: produto.id, nome: produto.nome, quantidade, valor_unitario: Number(produto.preco), variante_id: variante?.id || null, variante_nome: variante?.nome || null, complementos: selecionados, observacao: String(item.observacao || '').slice(0, 500) || null })
    }
    subtotalCalculado = Math.round(subtotalCalculado * 100) / 100
    const pagamentosCfg = cfg.formas_pagamento_aceitas
    const pagamentosAtivos = Array.isArray(cfg.formas_pagamento) ? cfg.formas_pagamento : pagamentosCfg && typeof pagamentosCfg === 'object' ? Object.entries(pagamentosCfg).filter(([, v]) => v).map(([k]) => k) : ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito']
    if (!pagamentosAtivos.includes(forma_pagamento)) return NextResponse.json({ error: 'Forma de pagamento desabilitada' }, { status: 400 })
    let taxaCalculada = 0
    if (tipo_entrega === 'delivery') {
      if (!endereco_entrega || !numero_entrega) return NextResponse.json({ error: 'Endereco e numero sao obrigatorios' }, { status: 400 })
      if (cfg.entrega_metodo === 'km') {
        const token=process.env.MAPBOX_ACCESS_TOKEN; const origem={latitude:tenant.latitude,longitude:tenant.longitude}
        if(!token||!Number.isFinite(Number(origem.latitude))||!Number.isFinite(Number(origem.longitude)))return NextResponse.json({error:'Não foi possível calcular a rota de entrega'},{status:400})
        const address=`${String(endereco_entrega).trim()}, ${String(numero_entrega).trim()}${bairro_entrega?`, ${String(bairro_entrega).trim()}`:''}`.slice(0,400)
        const geoResponse=await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=br&language=pt&limit=1&access_token=${encodeURIComponent(token)}`,{cache:'no-store'})
        if(!geoResponse.ok)return NextResponse.json({error:'Não foi possível validar o endereço de entrega'},{status:502})
        const feature=(await geoResponse.json()).features?.[0],destinationLng=Number(feature?.center?.[0]),destinationLat=Number(feature?.center?.[1])
        if(!Number.isFinite(destinationLng)||destinationLng < -180||destinationLng > 180||!Number.isFinite(destinationLat)||destinationLat < -90||destinationLat > 90)return NextResponse.json({error:'Endereço de entrega não localizado'},{status:400})
        const sentLng=Number(cliente_longitude),sentLat=Number(cliente_latitude)
        if(Number.isFinite(sentLng)&&Number.isFinite(sentLat)&&Math.hypot(sentLng-destinationLng,sentLat-destinationLat)>.03)return NextResponse.json({error:'O endereço mudou. Volte e selecione novamente a sugestão.'},{status:409})
        const coords=`${Number(origem.longitude)},${Number(origem.latitude)};${destinationLng},${destinationLat}`
        const routeData=await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?overview=false&access_token=${encodeURIComponent(token)}`,{cache:'no-store'}).then(r=>r.json());const route=routeData.routes?.[0]
        if(!route)return NextResponse.json({error:'Rota de entrega não encontrada'},{status:400});const km=route.distance/1000;const kmCfg=cfg.entrega_km||{}
        if(km>Number(kmCfg.max_km||Infinity))return NextResponse.json({error:'Endereço fora da área de entrega'},{status:400});const raw=Math.max(Number(kmCfg.minimo||0),km*Number(kmCfg.valor_km||0));taxaCalculada=kmCfg.arredondamento==='ceil'?Math.ceil(raw):kmCfg.arredondamento==='round'?Math.round(raw):Math.round(raw*100)/100
      } else {
        if (!bairro_entrega) return NextResponse.json({ error: 'Bairro obrigatorio' }, { status: 400 })
        const { data: bairroDb } = await admin.from('enderecos_entrega').select('taxa').eq('tenant_id', tenant.id).eq('bairro', bairro_entrega).eq('ativo',true).maybeSingle()
        if (!bairroDb) return NextResponse.json({ error: 'Bairro invalido' }, { status: 400 })
        taxaCalculada = Number(bairroDb.taxa || 0)
      }
    }
    const valorMinimo = cfg.valor_minimo_pedido || 0
    if (valorMinimo > 0 && subtotalCalculado < valorMinimo) {
      return NextResponse.json({
        error: `Pedido mínimo de R$ ${valorMinimo.toFixed(2).replace('.', ',')}`,
      }, { status: 400 })
    }

    const whatsappLimpo = cliente_whatsapp.replace(/\D/g, '')
    if (!cliente_access_token || String(cliente_access_token).length < 32) return NextResponse.json({ error: 'Identidade local ausente' }, { status: 400 })
    const clienteTokenHash = hashAccessToken(String(cliente_access_token))
    const { data: identityMatches } = await admin.from('clientes').select('acesso_token_hash').eq('tenant_id', tenant.id).eq('acesso_token_hash', clienteTokenHash).limit(2)
    if ((identityMatches || []).length > 1) return NextResponse.json({ error: 'Não foi possível processar a solicitação' }, { status: 409 })
    const identidadeExistente = identityMatches?.[0]
    if (identidadeExistente?.acesso_token_hash && !tokenMatches(String(cliente_access_token), identidadeExistente.acesso_token_hash)) {
      return NextResponse.json({ error: 'Não foi possível processar a solicitação' }, { status: 403 })
    }

    // 4) Contar pedidos anteriores do cliente (pra "Xº pedido")
    const { count: contagem } = await admin
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .eq('cliente_acesso_token_hash', clienteTokenHash)

    const contagemPedidos = (contagem || 0) + 1

    // 4b) Verifica se é aniversário do cliente hoje (desconto automático de 10%)
    let descontoAniversario = 0
    let aniversarioHoje = false
    try {
      const { data: clienteMatches } = await admin
        .from('clientes')
        .select('data_nascimento')
        .eq('tenant_id', tenant.id)
        .eq('acesso_token_hash', clienteTokenHash)
        .limit(2)
      const clienteDb = clienteMatches?.length === 1 ? clienteMatches[0] : null

      if (clienteDb?.data_nascimento) {
        const dn = new Date(clienteDb.data_nascimento)
        const hoje = new Date()
        // Comparar dia/mês (ignora ano) no fuso do Brasil
        const dnBR = new Date(dn.getTime() - 3 * 60 * 60 * 1000)
        const hojeBR = new Date(hoje.getTime() - 3 * 60 * 60 * 1000)
        if (dnBR.getUTCDate() === hojeBR.getUTCDate() && dnBR.getUTCMonth() === hojeBR.getUTCMonth()) {
          aniversarioHoje = true
          // 10% de desconto, sobre o subtotal (não sobre entrega)
          const pct = (cfg.desconto_aniversario_percent || 10) / 100
          descontoAniversario = Math.round(subtotalCalculado * pct * 100) / 100
        }
      }
    } catch {
      // Não bloqueia
    }

    // Valor final considerando desconto de aniversário
    // Descontos enviados pelo cliente nao sao aceitos sem revalidacao server-side.
    // O aniversario e calculado acima a partir do cadastro persistido.
    let descontoCupom = 0
    let cupomValidado: string | null = null
    if (cupom_aplicado) {
      const codigo = String(cupom_aplicado).trim().toUpperCase()
      const { data: cupom } = await admin.from('cupons')
        .select('codigo,tipo,valor,valor_minimo_pedido,validade,max_usos,usos_atuais,ativo')
        .eq('tenant_id', tenant.id).eq('codigo', codigo).eq('ativo', true).maybeSingle()
      const valido = cupom && (!cupom.validade || new Date(`${cupom.validade}T23:59:59`) >= new Date()) &&
        (!cupom.max_usos || Number(cupom.usos_atuais || 0) < Number(cupom.max_usos)) &&
        subtotalCalculado >= Number(cupom.valor_minimo_pedido || 0)
      if (!valido) return NextResponse.json({ error: 'Cupom invalido, expirado ou esgotado' }, { status: 400 })
      descontoCupom = cupom.tipo === 'percentual'
        ? subtotalCalculado * Number(cupom.valor) / 100
        : Number(cupom.valor)
      descontoCupom = Math.round(Math.min(subtotalCalculado, descontoCupom) * 100) / 100
      cupomValidado = codigo
    }
    const valorDescontoTotal = Math.min(subtotalCalculado, descontoAniversario + descontoCupom)
    const valorTotalFinal = Math.max(0, Math.round((subtotalCalculado + taxaCalculada - valorDescontoTotal) * 100) / 100)
    if (forma_pagamento === 'dinheiro' && troco_para && Number(troco_para) < valorTotalFinal) {
      return NextResponse.json({ error: 'O valor para troco deve ser maior ou igual ao total' }, { status: 400 })
    }

    // 5) Criar pedido
    const itensParaInserir = itensValidados.map((item: any) => ({
      produto_id: item.produto_id,
      nome: item.nome,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      variante_id: item.variante_id || null,
      variante_nome: item.variante_nome || null,
      complementos: item.complementos || [],
      observacao: item.observacao || null,
    }))
    const aniversarioIso = cliente_aniversario ? String(cliente_aniversario) : ''
    if (aniversarioIso && !validIsoDate(aniversarioIso)) return NextResponse.json({ error: 'Data de nascimento inválida' }, { status: 400 })
    const idempotencyKey = request.headers.get('idempotency-key') || body.idempotency_key
    if (!idempotencyKey || String(idempotencyKey).length < 32) return NextResponse.json({ error: 'Chave de idempotência ausente' }, { status: 400 })


    const { data: pedido, error: estoqueError } = await admin.rpc('criar_pedido_atomico', {
      p_tenant_id: tenant.id,
      p_token_hash: clienteTokenHash,
      p_idempotency_hash: hashAccessToken(`${tenant.id}:${String(idempotencyKey)}`),
      p_cliente: { nome: cliente_nome, telefone: whatsappLimpo, endereco: endereco_entrega || '', data_nascimento: aniversarioIso, cpf: cliente_cpf ? normalizeCpf(cliente_cpf) : '' },
      p_pedido: { valor_subtotal: subtotalCalculado, taxa_entrega: taxaCalculada, valor_desconto: valorDescontoTotal, valor_total: valorTotalFinal, forma_pagamento, troco_para: troco_para || '', bairro_entrega: bairro_entrega || '', endereco_entrega: endereco_entrega || '', numero_entrega: numero_entrega || '', complemento_entrega: complemento_entrega || '', tipo_entrega, observacoes: observacoes || '', cupom_aplicado: cupomValidado || '' },
      p_itens: itensValidados,
      p_ignorar_estoque: venderSemEstoque,
    })
    if (estoqueError || !pedido) {
      const erroMsg = estoqueError?.message || ''
      console.error('Erro criar_pedido_atomico:', estoqueError)
      if (erroMsg.includes('estoque_produto')) {
        return NextResponse.json({ error: 'Um dos itens selectedo nao tem estoque suficiente' }, { status: 409 })
      } else if (erroMsg.includes('estoque_complemento')) {
        return NextResponse.json({ error: 'Um dos complementos nao tem estoque suficiente' }, { status: 409 })
      } else if (erroMsg.includes('estoque_insumo')) {
        return NextResponse.json({ error: 'Um dos ingredientes nao tem estoque suficiente' }, { status: 409 })
      } else if (erroMsg.includes('cupom')) {
        return NextResponse.json({ error: 'Cupom indisponivel ou invalido' }, { status: 409 })
      }
      // Inclui o código do erro para diagnóstico
      return NextResponse.json({ error: 'Nao foi possivel concluir o pedido. Tente novamente em alguns instantes.', debug: estoqueError?.code || erroMsg }, { status: 409 })
    }

    return NextResponse.json({
      id: pedido.id,
      codigo: pedido.codigo,
      status: pedido.status,
      valor_subtotal: pedido.valor_subtotal,
      taxa_entrega: pedido.taxa_entrega,
      valor_desconto: pedido.valor_desconto,
      valor_total: pedido.valor_total,
      tipo_entrega: pedido.tipo_entrega,
      forma_pagamento: pedido.forma_pagamento,
      contagem_pedidos: contagemPedidos,
      itens: itensParaInserir,
      // Dados do cliente para o painel do lojista
      cliente_nome: cliente_nome,
      cliente_whatsapp: whatsappLimpo,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error: any) {
    console.error('Erro ao criar pedido público:', error)
    return NextResponse.json({ error: error.message || 'Erro ao criar pedido' }, { status: 500 })
  }
}
