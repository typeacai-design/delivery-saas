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
    .order('ordem')

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

  const { data: variantes } = await supabase
    .from('variantes')
    .select('*')
    .in('produto_id', produtos?.map(p => p.id) || [])

  const { data: complementos } = await supabase
    .from('complementos')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('ativo', true)

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

  // Buscar configurações do tenant (formas de pagamento)
  const { data: tenantConfig } = await supabase
    .from('tenants')
    .select('config')
    .eq('id', tenant.id)
    .single()

  const config = (tenant.config || {}) as any
  const horario = config.horario || { abre: '08:00', fecha: '22:00' }
  const layout = config.cardapio_layout || 'classico'
  const paleta = config.cardapio_paleta || 'verde-classica'
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Fortaleza' }))
  const diaAtual = agora.getDay()
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes()
  const horariosDia = Array.isArray(config.horarios_dias) ? config.horarios_dias.find((item: any) => Number(item.dia ?? item.dia_semana) === diaAtual) : null
  const inicio = String(horariosDia?.abre || horariosDia?.inicio || horario.abre || '00:00').split(':').map(Number)
  const fim = String(horariosDia?.fecha || horariosDia?.fim || horario.fecha || '23:59').split(':').map(Number)
  const dentroHorario = horariosDia?.ativo === false ? false : minutosAgora >= inicio[0] * 60 + inicio[1] && minutosAgora <= fim[0] * 60 + fim[1]
  const lojaAberta = config.loja_aberta !== false && dentroHorario
  const totalAvaliacoes = avaliacoesAprovadas?.length || 0
  const avaliacaoMedia = totalAvaliacoes ? Math.round((avaliacoesAprovadas || []).reduce((s: number, item: any) => s + Number(item.nota), 0) / totalAvaliacoes * 10) / 10 : 0
  const pagamentosSalvos = tenantConfig?.config?.formas_pagamento_aceitas
  const formasPagamentoConfig = Array.isArray(tenantConfig?.config?.formas_pagamento)
    ? tenantConfig.config.formas_pagamento
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
    horario,
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
