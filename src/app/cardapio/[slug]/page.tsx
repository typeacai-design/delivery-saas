import { notFound } from 'next/navigation'
import { MapPin, Clock, Phone, Store } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { CardapioCliente } from '@/components/cardapio-cliente'
import { getCardapioTheme } from '@/lib/cardapio-theme'

// Revalidar a cada 30s pra refletir cadastros quase em tempo real
export const revalidate = 30

// Page SEM auth - cardápio é público
export default async function CardapioPublicoPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Esta pagina roda somente no servidor. A service role evita que o cardapio
  // publico dependa da sessao anonima/RLS para carregar os dados, sem expor a
  // chave ao navegador. Os filtros de tenant/status/ativo continuam abaixo.
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active') // Só lojistas ativos
    .single()

  if (tenantError || !tenant) {
    console.error('Erro ao carregar tenant do cardapio publico', {
      slug,
      message: tenantError?.message,
    })
    notFound()
  }

  const { data: categorias } = await supabase
    .from('categorias')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  const { data: categoriasProduto } = await supabase
    .from('categorias_produtos')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('ativo', true)
    .order('ordem')

  const { data: produtos } = await supabase
    .from('produtos')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  const { data: variantes } = await supabase
    .from('variantes')
    .select('*')
    .in('produto_id', produtos?.map(p => p.id) || [])

  const { data: complementos } = await supabase
    .from('complementos')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  const { data: listasComplementos } = await supabase
    .from('categorias_complementos')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('ativo', true)
    .order('ordem')

  const { data: produtoComplementos } = await supabase
    .from('produto_complementos')
    .select('*')
    .in('produto_id', produtos?.map(p => p.id) || [])

  const { data: avaliacoesAprovadas } = await supabase
    .from('avaliacoes')
    .select('nota')
    .eq('tenant_id', tenant.id)
    .eq('aprovado', true)

  const { data: enderecos } = await supabase
    .from('enderecos_entrega')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('ativo', true)
    .order('bairro')

  const config = (tenant.config || {}) as any
  const horario = config.horario || { abre: '08:00', fecha: '22:00' }
  const layout = config.cardapio_layout || 'classico'
  const paleta = config.cardapio_paleta || 'verde-classica'

  // Logica melhorada de horario - usar timezone do Brasilia
  const agora = new Date()
  // Ajustar para timezone de Brasilia (UTC-3)
  const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const diaAtual = brasilia.getDay()
  const minutosAgora = brasilia.getHours() * 60 + brasilia.getMinutes()

  // Mapear dia da semana (0-6) para chave
  const DIAS_CHAVES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

  // Pegar horarios_dias - suporta AMBOS formatos: array ou objeto com chaves
  let horariosDia = null
  if (Array.isArray(config.horarios_dias)) {
    horariosDia = config.horarios_dias.find((item: any) => Number(item.dia ?? item.dia_semana) === diaAtual)
  } else if (config.horarios_dias && typeof config.horarios_dias === 'object') {
    // Formato objeto: { seg: {abre, fecha, ativo}, ter: {...}, ... }
    const chaveDia = DIAS_CHAVES[diaAtual]
    horariosDia = config.horarios_dias[chaveDia]
  }

  const parseTime = (s: any) => {
    if (!s) return null
    const parts = String(s).split(':').map(Number)
    return parts.length >= 2 ? parts[0] * 60 + parts[1] : null
  }

  const inicioMin = parseTime(horariosDia?.abre || horariosDia?.inicio) ?? parseTime(horario.abre) ?? 480 // 08:00 default
  const fimMin = parseTime(horariosDia?.fecha || horariosDia?.fim) ?? parseTime(horario.fecha) ?? 1320 // 22:00 default

  // Verificar se o dia está marcado como inativo
  const diaInativo = horariosDia?.ativo === false
  const dentroHorario = !diaInativo && minutosAgora >= inicioMin && minutosAgora <= fimMin

  // Loja aberta: override manual tem prioridade sobre horário
  // - config.loja_aberta === true → abre mesmo fora do horário
  // - config.loja_aberta === false → fecha mesmo dentro do horário
  // - config.loja_aberta undefined/null → segue o horário
  const overrideLojaAberta = config.loja_aberta
  const lojaAberta = overrideLojaAberta !== undefined
    ? overrideLojaAberta
    : dentroHorario
  const totalAvaliacoes = avaliacoesAprovadas?.length || 0
  const avaliacaoMedia = totalAvaliacoes ? Math.round((avaliacoesAprovadas || []).reduce((s: number, item: any) => s + Number(item.nota), 0) / totalAvaliacoes * 10) / 10 : 0
  // horarioDoDia: do dia atual do horarios_dias, ou fallback para o campo legado config.horario
  const horarioDoDia = {
    abre: horariosDia?.abre || horariosDia?.inicio || horario.abre || '08:00',
    fecha: horariosDia?.fecha || horariosDia?.fim || horario.fecha || '22:00',
    ativo: horariosDia?.ativo !== false,
  }
  const pagamentosSalvos = config.formas_pagamento_aceitas
  const formasPagamentoConfig = Array.isArray(config.formas_pagamento)
    ? config.formas_pagamento
    : pagamentosSalvos && typeof pagamentosSalvos === 'object'
      ? Object.entries(pagamentosSalvos).filter(([, ativo]) => ativo).map(([id]) => id)
      : ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito']

  // Mapear formas de pagamento
  const formasPagamentoMap: Record<string, { id: string; nome: string }> = {
    dinheiro: { id: 'dinheiro', nome: 'Dinheiro' },
    pix: { id: 'pix', nome: 'PIX' },
    cartao_credito: { id: 'cartao_credito', nome: 'Cartão de Crédito' },
    cartao_debito: { id: 'cartao_debito', nome: 'Cartão de Débito' },
    vale_refeicao: { id: 'vale_refeicao', nome: 'Vale Refeição' },
  }

  const formasPagamento = formasPagamentoConfig
    .filter((f: string) => formasPagamentoMap[f])
    .map((f: string) => formasPagamentoMap[f])

  const theme = getCardapioTheme(paleta, config.cardapio_cores)
  const corPaleta = theme.primary

  const cardapioData = {
    tenant: {
      id: tenant.id,
      nome: tenant.nome,
      slug: tenant.slug,
      telefone: tenant.telefone || '',
      logo_url: tenant.logo_url,
      banner_url: tenant.banner_url,
      banners: (Array.isArray(config.cardapio_banners) ? config.cardapio_banners.map((banner: any) => banner?.url).filter(Boolean) : []).length
        ? config.cardapio_banners.map((banner: any) => banner?.url).filter(Boolean)
        : (tenant.banner_url ? [tenant.banner_url] : []),
      endereco: tenant.endereco || config.endereco || '',
    },
    categorias: categorias || [],
    categoriasProduto: categoriasProduto || [],
    produtos: produtos || [],
    variantes: variantes || [],
    complementos: complementos || [],
    listasComplementos: listasComplementos || [],
    produtoComplementos: produtoComplementos || [],
    enderecos: enderecos || [],
    formasPagamento,
    entregaConfig: { metodo: config.entrega_metodo || 'bairro', km: config.entrega_km || {}, origem: { latitude: tenant.latitude, longitude: tenant.longitude, endereco: tenant.endereco || '' } },
    horario: horarioDoDia,
    horariosSemana: Array.isArray(config.horarios_dias)
      ? config.horarios_dias.map((h: any) => ({ dia: DIAS_CHAVES[h.dia ?? h.dia_semana] || 'Hoje', abre: h.abre, fecha: h.fecha, ativo: h.ativo !== false }))
      : (config.horarios_dias && typeof config.horarios_dias === 'object')
        ? DIAS_CHAVES.map((chave) => {
            const h = (config.horarios_dias as any)[chave]
            return { dia: chave, abre: h?.abre, fecha: h?.fecha, ativo: h?.ativo !== false }
          })
        : [],
    layout,
    paleta,
    tipografia: config.cardapio_tipografia || 'classica',
    corPaleta,
    theme,
    lojaAberta,
    avaliacaoMedia,
    totalAvaliacoes,
    whatsappAjuda: {
      ativo: config.cardapio_whatsapp_ativo !== false,
      numero: config.cardapio_whatsapp_numero || tenant.telefone || '',
      mensagem: config.cardapio_whatsapp_mensagem || 'Olá! Estou no seu site e preciso de ajuda.',
    },
    faixaAvisos: {
      ativo: config.cardapio_aviso_ativo === true,
      mensagem: config.cardapio_aviso_mensagem || '',
      corFundo: config.cardapio_aviso_fundo || '#111827',
      corTexto: config.cardapio_aviso_texto || '#FFFFFF',
      link: config.cardapio_aviso_link || '',
      textos: Array.isArray(config.cardapio_aviso_textos) ? config.cardapio_aviso_textos : [],
      animacao: config.cardapio_aviso_animacao || 'continuo',
      velocidade: Number(config.cardapio_aviso_velocidade || 12),
    },
    segundaFaixa: { ativo: config.cardapio_segunda_faixa_ativa === true, mensagem: config.cardapio_segunda_faixa_mensagem || '', link: config.cardapio_segunda_faixa_link || '' },
    valorMinimoPedido: config.valor_minimo_pedido || 0,
    totalBairros: enderecos?.length || 0,
  }

  return <CardapioCliente data={cardapioData} />
}
