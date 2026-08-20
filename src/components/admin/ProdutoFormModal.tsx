'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import { formatCurrency } from '@/lib/utils'
import {
  X, Upload, Image as ImageIcon, Info, Check, Save, Trash2,
  ChevronDown, Clock, Tag, Star, Box, Layers, Search, Package, Plus
} from 'lucide-react'

type FormState = {
  categoria_id: string
  categoria_produto_id: string
  nome: string
  descricao: string
  imagem_url: string
  imagem_path: string
  preco: string
  preco_riscado: string
  ordem: string
  codigo_externo: string
  // Pontos
  pontos: string
  // Regras
  eh_adicional: boolean
  disponivel_mesa: boolean
  disponivel_delivery: boolean
  disponivel_retirada: boolean
  etiquetas: string[]
  tempo_preparo_min: number
  pode_ser_metade: boolean
  texto_metade: string
  fracionar_item: boolean
  // Disponibilidade
  dias_disponiveis: number[]
  horario_inicio: string
  horario_fim: string
  // Limites
  limite_vendas_dia: string
  limite_vendas_turno: string
  // Estoque
  controlar_estoque: boolean
  quantidade_estoque: string
  // Complementos
  complemento_ids: string[]
  // Matéria-prima (vinculada ao produto com qtd por unidade)
  ingredientes: Array<{ insumo_id: string; quantidade: string }>
}

const FORM_VAZIO: FormState = {
  categoria_id: '',
  categoria_produto_id: '',
  nome: '',
  descricao: '',
  imagem_url: '',
  imagem_path: '',
  preco: '',
  preco_riscado: '',
  ordem: '',
  codigo_externo: '',
  pontos: '',
  eh_adicional: false,
  disponivel_mesa: true,
  disponivel_delivery: true,
  disponivel_retirada: true,
  etiquetas: [],
  tempo_preparo_min: 30,
  pode_ser_metade: false,
  texto_metade: '',
  fracionar_item: false,
  dias_disponiveis: [0, 1, 2, 3, 4, 5, 6],
  horario_inicio: '00:00',
  horario_fim: '23:59',
  limite_vendas_dia: '',
  limite_vendas_turno: '',
  controlar_estoque: false,
  quantidade_estoque: '',
  complemento_ids: [],
  ingredientes: [],
}

const DIAS_SEMANA = [
  { id: 0, label: 'Dom' },
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
]

const TEMPO_PREPARO_OPCOES = [5, 10, 15, 20, 30, 40, 45, 60, 90, 120]

const ETIQUETAS_OPCOES = [
  { id: 'promocao', label: 'Promoção', icone: '🔥', bg: '#FEF3C7', color: '#92400E', border: '#F59E0B' },
  { id: 'mais_vendido', label: 'Mais vendido', icone: '⭐', bg: '#FEF9C3', color: '#854D0E', border: '#EAB308' },
  { id: 'novidade', label: 'Novidade', icone: '✨', bg: '#DBEAFE', color: '#1E3A8A', border: '#3B82F6' },
]

type Props = {
  produto?: any
  categorias: any[]
  categoriasProduto?: any[]
  todosProdutos?: any[] // para validar ordem duplicada
  onClose: () => void
  onSaved: () => void
}

export default function ProdutoFormModal({ produto, categorias, categoriasProduto = [], todosProdutos = [], onClose, onSaved }: Props) {
  // Calcula custo do produto baseado nos ingredientes vinculados.
  // Reaproveita os `insumos` (carregados via loadInsumos) e `form.ingredientes`.
  const custoCalculado = () => {
    if (!insumos.length) return 0
    return form.ingredientes.reduce((acc, it) => {
      const insumo = insumos.find((i) => i.id === it.insumo_id)
      const qtd = parseFloat(it.quantidade)
      if (!insumo || isNaN(qtd) || qtd <= 0) return acc
      return acc + qtd * Number(insumo.custo_unitario)
    }, 0)
  }

  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [complementos, setComplementos] = useState<any[]>([])
  const [categoriasComp, setCategoriasComp] = useState<any[]>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')
  const [slug, setSlug] = useState<string>('')
  const [insumos, setInsumos] = useState<any[]>([])
  const supabase = createClient()

  const carregarSlug = async () => {
    const tenantId = await activeTenantId()
    if (!tenantId) return
    const { data } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .single()
    if (data?.slug) setSlug(data.slug)
  }

  const loadInsumos = async () => {
    const tenantId = await activeTenantId()
    if (!tenantId) return
    const { data } = await supabase
      .from('insumos')
      .select('id, nome, unidade, custo_unitario, quantidade_atual')
      .eq('tenant_id', tenantId)
      .order('nome')
    setInsumos(data || [])
  }

  const loadVinculosIngredientes = async () => {
    if (!produto) return
    const { data } = await supabase
      .from('produto_ingredientes')
      .select('insumo_id, quantidade')
      .eq('produto_id', produto.id)
    const items = (data || []).map((r: any) => ({
      insumo_id: r.insumo_id,
      quantidade: String(r.quantidade),
    }))
    setForm((f) => ({ ...f, ingredientes: items }))
  }

  useEffect(() => {
    if (produto) {
      setForm({
        ...FORM_VAZIO,
        ...produto,
        preco: produto.preco != null ? String(produto.preco) : '',
        preco_riscado: produto.preco_riscado != null ? String(produto.preco_riscado) : '',
        ordem: produto.ordem != null ? String(produto.ordem) : '',
        pontos: produto.pontos != null ? String(produto.pontos) : '',
        etiquetas: produto.etiquetas ?? [],
        dias_disponiveis: produto.dias_disponiveis ?? [0, 1, 2, 3, 4, 5, 6],
        horario_inicio: (produto.horario_inicio || '00:00:00').slice(0, 5),
        horario_fim: (produto.horario_fim || '23:59:00').slice(0, 5),
        limite_vendas_dia: produto.limite_vendas_dia != null ? String(produto.limite_vendas_dia) : '',
        limite_vendas_turno: produto.limite_vendas_turno != null ? String(produto.limite_vendas_turno) : '',
        quantidade_estoque: produto.quantidade_estoque != null ? String(produto.quantidade_estoque) : '',
      })
    }
    loadComplementos()
    loadCategoriasComp()
    loadVinculos()
    carregarSlug()
    loadInsumos()
    loadVinculosIngredientes()
  }, [])

  const loadComplementos = async () => {
    const tenantId = await activeTenantId()
    if (!tenantId) return
    const { data } = await supabase
      .from('complementos')
      .select('id, nome, preco, categoria_id')
      .eq('tenant_id', tenantId)
      .eq('ativo', true)
      .order('nome')
    setComplementos(data || [])
  }

  const loadCategoriasComp = async () => {
    const tenantId = await activeTenantId()
    if (!tenantId) return
    const { data } = await supabase
      .from('categorias_complementos')
      .select('id, nome, descricao')
      .eq('tenant_id', tenantId)
      .eq('ativo', true)
      .order('ordem')
    setCategoriasComp(data || [])
  }

  const loadVinculos = async () => {
    if (!produto) return
    const { data } = await supabase
      .from('produto_complementos')
      .select('complemento_id')
      .eq('produto_id', produto.id)
    const ids = (data || []).map((r: any) => r.complemento_id)
    setForm((f) => ({ ...f, complemento_ids: ids }))
  }

  const salvar = async () => {
    if (!form.nome.trim() || !form.preco || !form.categoria_id) {
      setErro('Preencha nome, preço e categoria.')
      return
    }
    setSalvando(true)
    setErro('')
    const tid = await activeTenantId()
    if (!tid) { setSalvando(false); return }

    const num = (v: string) => (v === '' ? null : parseFloat(v))
    const numOrZero = (v: string, def = 0) => (v === '' ? def : parseFloat(v))
    const intOrZero = (v: string, def = 0) => (v === '' ? def : parseInt(v, 10))
    const ordemNum = intOrZero(form.ordem, 0)

    // Validação de ordem duplicada dentro da mesma sessão
    if (ordemNum > 0 && todosProdutos.length > 0) {
      const mesmoGrupo = todosProdutos.filter(
        (p: any) => p.categoria_id === form.categoria_id && p.id !== produto?.id
      )
      const duplicado = mesmoGrupo.find((p: any) => p.ordem === ordemNum)
      if (duplicado) {
        setErro(`Já existe "${duplicado.nome}" com ordem ${ordemNum} nesta sessão.`)
        setSalvando(false)
        return
      }
    }

    const payload = {
      categoria_id: form.categoria_id,
      categoria_produto_id: form.categoria_produto_id || null,
      nome: form.nome,
      descricao: form.descricao || null,
      preco: parseFloat(form.preco),
      preco_riscado: num(form.preco_riscado),
      imagem_url: form.imagem_url || null,
      imagem_path: form.imagem_path || null,
      tempo_preparo_min: form.tempo_preparo_min,
      ordem: ordemNum,
      codigo_externo: form.codigo_externo || null,
      pontos: intOrZero(form.pontos, 0),
      eh_adicional: form.eh_adicional,
      disponivel_mesa: form.disponivel_mesa,
      disponivel_delivery: form.disponivel_delivery,
      disponivel_retirada: form.disponivel_retirada,
      etiquetas: form.etiquetas,
      secao_destaque: form.etiquetas.length > 0,
      pode_ser_metade: form.pode_ser_metade,
      texto_metade: form.texto_metade || null,
      fracionar_item: form.fracionar_item,
      dias_disponiveis: form.dias_disponiveis,
      horario_inicio: form.horario_inicio,
      horario_fim: form.horario_fim,
      limite_vendas_dia: intOrZero(form.limite_vendas_dia),
      limite_vendas_turno: intOrZero(form.limite_vendas_turno),
      controlar_estoque: form.controlar_estoque,
      quantidade_estoque: intOrZero(form.quantidade_estoque),
    }

    let produtoId = produto?.id

    if (produto) {
      const { error } = await supabase.from('produtos').update(payload).eq('id', produto.id)
      if (error) {
        setErro(`Não foi possível salvar o produto: ${error.message}`)
        setSalvando(false)
        return
      }
    } else {
      const { data: novo, error } = await supabase.from('produtos').insert({
        ...payload,
        tenant_id: tid,
        ativo: true,
      }).select('id').single()
      if (error || !novo?.id) {
        setErro(`Não foi possível criar o produto: ${error?.message || 'produto sem ID'}`)
        setSalvando(false)
        return
      }
      produtoId = novo?.id
    }

    if (produtoId) {
      // Sincroniza por diferença para nunca apagar vínculos válidos antes de
      // confirmar que os novos foram gravados.
      const { data: vinculosAtuais, error: erroLeituraVinculos } = await supabase
        .from('produto_complementos')
        .select('complemento_id')
        .eq('produto_id', produtoId)
      if (erroLeituraVinculos) {
        setErro(`Produto salvo, mas não foi possível conferir os complementos: ${erroLeituraVinculos.message}`)
        setSalvando(false)
        return
      }
      const atuais = new Set((vinculosAtuais || []).map((v: any) => v.complemento_id))
      const desejados = new Set(form.complemento_ids)
      const adicionar = form.complemento_ids.filter((id) => !atuais.has(id))
      const remover = [...atuais].filter((id) => !desejados.has(id))

      if (adicionar.length > 0) {
        const { error } = await supabase.from('produto_complementos').insert(
          adicionar.map((cid) => ({
            produto_id: produtoId,
            complemento_id: cid,
          }))
        )
        if (error) {
          setErro(`Produto salvo, mas os complementos não foram vinculados: ${error.message}`)
          setSalvando(false)
          return
        }
      }
      if (remover.length > 0) {
        const { error } = await supabase
          .from('produto_complementos')
          .delete()
          .eq('produto_id', produtoId)
          .in('complemento_id', remover)
        if (error) {
          setErro(`Produto salvo, mas não foi possível remover vínculos antigos: ${error.message}`)
          setSalvando(false)
          return
        }
      }

      // Sincronizar ingredientes vinculados
      await supabase
        .from('produto_ingredientes')
        .delete()
        .eq('produto_id', produtoId)
      const ingredientesValidos = form.ingredientes.filter(
        (it) => it.insumo_id && it.quantidade !== '' && parseFloat(it.quantidade) > 0
      )
      if (ingredientesValidos.length > 0) {
        await supabase.from('produto_ingredientes').insert(
          ingredientesValidos.map((it) => ({
            tenant_id: tid,
            produto_id: produtoId,
            insumo_id: it.insumo_id,
            quantidade: parseFloat(it.quantidade),
          }))
        )
      }
    }

    // Revalidar cardápio público para refletir o item novo
    if (slug) {
      try {
        await fetch('/api/revalidate-cardapio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        })
      } catch {
        // Silencioso — fallback do revalidate=30 cobre
      }
    }

    setSalvando(false)
    onSaved()
    onClose()
  }

  const toggleDia = (id: number) => {
    setForm((f) => ({
      ...f,
      dias_disponiveis: f.dias_disponiveis.includes(id)
        ? f.dias_disponiveis.filter((d) => d !== id)
        : [...f.dias_disponiveis, id],
    }))
  }

  const toggleComplemento = (id: string) => {
    setForm((f) => ({
      ...f,
      complemento_ids: f.complemento_ids.includes(id)
        ? f.complemento_ids.filter((c) => c !== id)
        : [...f.complemento_ids, id],
    }))
  }

  const complementoFiltrado = categoriaFiltro
    ? complementos.filter((c) => c.categoria_id === categoriaFiltro)
    : complementos

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-4 sm:p-6 overflow-y-auto" style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col" style={{ maxHeight: 'calc(100vh - 48px)' }}>
        {/* ============ HEADER ============ */}
        <div className="flex items-start justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--line-strong)' }}>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {produto ? 'Editar item' : 'Criar item'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure os detalhes do item
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <X size={20} />
          </button>
        </div>

        {/* ============ BODY SCROLL ============ */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50">
          {/* ====== CARD 1: Dados básicos ====== */}
          <CardSection title="Dados básicos">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome" required>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Copo 300ml"
                  className="form-input"
                  autoFocus
                />
              </Field>

              <Field label="Cód. Externo" hint="(ex: 001)">
                <input
                  value={form.codigo_externo}
                  onChange={(e) => setForm({ ...form, codigo_externo: e.target.value })}
                  placeholder="001"
                  className="form-input"
                />
              </Field>

              <Field label="Sessão" required>
                <select
                  value={form.categoria_id}
                  onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
                  className="form-input"
                >
                  <option value="">Selecione...</option>
                  {categorias.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </Field>

              <Field label="Categoria" hint="(atalho no cardápio)">
                <select
                  value={form.categoria_produto_id}
                  onChange={(e) => setForm({ ...form, categoria_produto_id: e.target.value })}
                  className="form-input"
                >
                  <option value="">Sem categoria</option>
                  {categoriasProduto.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </Field>

              <Field label="Ordem dentro do grupo" hint="(opcional)">
                <input
                  type="number"
                  value={form.ordem}
                  onChange={(e) => setForm({ ...form, ordem: e.target.value })}
                  className="form-input"
                  placeholder="0"
                />
              </Field>

              <Field label="Preço" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.preco}
                    onChange={(e) => setForm({ ...form, preco: e.target.value })}
                    placeholder="0,00"
                    className="form-input pl-10"
                  />
                </div>
              </Field>

              <Field label="Preço riscado" hint="(ex: de R$ 28,00 por R$ 14,00)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.preco_riscado}
                    onChange={(e) => setForm({ ...form, preco_riscado: e.target.value })}
                    placeholder="Vazio = sem promoção"
                    className="form-input pl-10"
                  />
                </div>
              </Field>

              <Field label="Tempo de preparo">
                <select
                  value={form.tempo_preparo_min}
                  onChange={(e) => setForm({ ...form, tempo_preparo_min: parseInt(e.target.value) })}
                  className="form-input"
                >
                  {TEMPO_PREPARO_OPCOES.map((t) => (
                    <option key={t} value={t}>{t} min</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Descrição" hint="(opcional, aparece no cardápio)">
              <textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Açaí com banana, granola e leite condensado"
                rows={2}
                className="form-input"
              />
            </Field>
          </CardSection>

          {/* ====== CARD 2: Foto ====== */}
          <CardSection title="Foto do item">
            <ImageUploader
              value={form.imagem_url}
              onChange={(url, path) => setForm({ ...form, imagem_url: url, imagem_path: path || '' })}
            />
          </CardSection>

          {/* ====== CARD 3: Pontos ====== */}
          <CardSection title="Pontos de fidelidade" icon={Star}>
            <p className="text-sm text-gray-500 mb-3 -mt-1">
              Quantos pontos o cliente ganha ao comprar este item.
            </p>
            <Field label="Pontos">
              <input
                type="number"
                min={0}
                value={form.pontos}
                onChange={(e) => setForm({ ...form, pontos: e.target.value })}
                placeholder="0"
                className="form-input max-w-[200px]"
              />
            </Field>
          </CardSection>

          {/* ====== CARD 4: Canais e etiquetas ====== */}
          <CardSection title="Visibilidade no cardápio">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ToggleCanal
                label="Mesa"
                checked={form.disponivel_mesa}
                onChange={(v) => setForm({ ...form, disponivel_mesa: v })}
              />
              <ToggleCanal
                label="Delivery"
                checked={form.disponivel_delivery}
                onChange={(v) => setForm({ ...form, disponivel_delivery: v })}
              />
              <ToggleCanal
                label="Retirada"
                checked={form.disponivel_retirada}
                onChange={(v) => setForm({ ...form, disponivel_retirada: v })}
              />
            </div>

            <div className="mt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Etiquetar este item como:
              </label>
              <div className="flex flex-wrap gap-2">
                {ETIQUETAS_OPCOES.map((et) => {
                  const ativo = form.etiquetas.includes(et.id)
                  return (
                    <button
                      key={et.id}
                      type="button"
                      onClick={() => {
                        const next = ativo
                          ? form.etiquetas.filter((e) => e !== et.id)
                          : [...form.etiquetas, et.id]
                        setForm({ ...form, etiquetas: next })
                      }}
                      className="px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-1.5"
                      style={
                        ativo
                          ? { background: et.bg, color: et.color, border: `1.5px solid ${et.border}` }
                          : { background: 'white', color: '#374151', border: '1px solid #D1D5DB' }
                      }
                    >
                      <span>{et.icone}</span>
                      {et.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                As etiquetas selecionadas aparecem como tag no cardápio do cliente.
              </p>
            </div>
          </CardSection>

          {/* ====== CARD 5: Regras (metade, fracionar, adicional) ====== */}
          <CardSection title="Regras de venda">
            <ToggleLinha
              label="Adicional de pedido"
              hint="Item vendido como extra (ex: cobertura, borda)"
              checked={form.eh_adicional}
              onChange={(v) => setForm({ ...form, eh_adicional: v })}
            />

            <ToggleLinha
              label="Pode ser metade?"
              hint="Permite escolher como metade (ex: pizza)"
              checked={form.pode_ser_metade}
              onChange={(v) => setForm({ ...form, pode_ser_metade: v })}
            />
            {form.pode_ser_metade && (
              <Field label="Qual a metade?" hint="(texto explicativo)">
                <input
                  value={form.texto_metade}
                  onChange={(e) => setForm({ ...form, texto_metade: e.target.value })}
                  placeholder="Ex: Metade de pizza"
                  className="form-input"
                />
              </Field>
            )}

            <ToggleLinha
              label="Fracionar item"
              hint="Permite fracionar em duas metades diferentes"
              checked={form.fracionar_item}
              onChange={(v) => setForm({ ...form, fracionar_item: v })}
            />
          </CardSection>

          {/* ====== CARD 6: Dias da semana ====== */}
          <CardSection title="Dias ativos deste item">
            <p className="text-sm text-gray-500 mb-3 -mt-1">
              <span className="inline-block size-3 rounded align-middle mr-1" style={{ background: 'var(--green)' }} /> verde = ativo
              <span className="inline-block size-3 rounded align-middle mx-1 ml-3 bg-gray-300" /> cinza = inativo
            </p>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((d) => {
                const ativo = form.dias_disponiveis.includes(d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDia(d.id)}
                    className="px-5 py-2.5 rounded-lg text-sm font-semibold transition"
                    style={
                      ativo
                        ? { background: 'var(--green)', color: 'white' }
                        : { background: '#E5E7EB', color: '#6B7280' }
                    }
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          </CardSection>

          {/* ====== CARD 7: Horário ====== */}
          <CardSection title="Horário disponível">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Início">
                <input
                  type="time"
                  value={form.horario_inicio}
                  onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })}
                  className="form-input"
                />
              </Field>
              <Field label="Fim">
                <input
                  type="time"
                  value={form.horario_fim}
                  onChange={(e) => setForm({ ...form, horario_fim: e.target.value })}
                  className="form-input"
                />
              </Field>
            </div>
          </CardSection>

          {/* ====== CARD 8: Limites de venda ====== */}
          <CardSection title="Limites de venda">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Vendidos diariamente" hint="(vazio = sem limite)">
                <input
                  type="number"
                  min={0}
                  value={form.limite_vendas_dia ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      limite_vendas_dia: e.target.value,
                    })
                  }
                  className="form-input"
                />
              </Field>
              <Field label="Vendidos por turno" hint="(vazio = sem limite)">
                <input
                  type="number"
                  min={0}
                  value={form.limite_vendas_turno ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      limite_vendas_turno: e.target.value,
                    })
                  }
                  className="form-input"
                />
              </Field>
            </div>
          </CardSection>

          {/* ====== CARD 9: Estoque ====== */}
          <CardSection title="Controle de estoque" icon={Box}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, controlar_estoque: false })}
                className="px-4 py-3 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
                style={
                  !form.controlar_estoque
                    ? { background: 'var(--green)', color: 'white' }
                    : { background: 'white', color: '#374151', border: '1px solid #D1D5DB' }
                }
              >
                <Check size={14} />
                Item sempre disponível
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, controlar_estoque: true })}
                className="px-4 py-3 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
                style={
                  form.controlar_estoque
                    ? { background: 'var(--green)', color: 'white' }
                    : { background: 'white', color: '#374151', border: '1px solid #D1D5DB' }
                }
              >
                <Box size={14} />
                Em estoque (controlar qtd)
              </button>
            </div>
            {form.controlar_estoque && (
              <Field label="Quantidade disponível" hint="(quando zerar, esconde do cardápio)" className="mt-4">
                <input
                  type="number"
                  min={0}
                  value={form.quantidade_estoque}
                  onChange={(e) =>
                    setForm({ ...form, quantidade_estoque: e.target.value })
                  }
                  className="form-input"
                />
              </Field>
            )}
          </CardSection>

          {/* ====== CARD 10: Complementos ====== */}
          <CardSection title="Complementos vinculados" icon={Layers}>
            <p className="text-sm text-gray-500 mb-3 -mt-1">
              Clique em uma lista para vincular todos os complementos de uma vez, ou selecione individualmente.
              Gerencie em <strong>Cardápio → Complementos</strong>.
            </p>

            {/* Seleção por listas */}
            {categoriasComp.length > 0 && (
              <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">🎯 Selecionar por lista</h4>
                <p className="text-xs text-blue-600 mb-3">Clique em uma lista para vincular todos os seus complementos de uma vez:</p>
                <div className="flex flex-wrap gap-2">
                  {categoriasComp.map((cat) => {
                    const compsDaLista = complementos.filter(c => c.categoria_id === cat.id)
                    const todosSelecionados = compsDaLista.length > 0 && compsDaLista.every(c => form.complemento_ids.includes(c.id))
                    const algunsSelecionados = compsDaLista.some(c => form.complemento_ids.includes(c.id)) && !todosSelecionados
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          const idsAtuais = new Set(form.complemento_ids)
                          compsDaLista.forEach(c => idsAtuais.add(c.id))
                          setForm((f: any) => ({ ...f, complemento_ids: [...idsAtuais] }))
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                          todosSelecionados
                            ? 'bg-green-500 text-white'
                            : algunsSelecionados
                            ? 'bg-yellow-100 border-2 border-yellow-400 text-yellow-800'
                            : 'bg-white border border-blue-300 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        {todosSelecionados && <Check size={14} />}
                        <span>{cat.nome}</span>
                        {cat.descricao && (
                          <span className="text-xs opacity-75">({cat.descricao})</span>
                        )}
                        <span className="text-xs opacity-60">({compsDaLista.length})</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value)}
                  className="form-input pl-9"
                >
                  <option value="">Todas as categorias</option>
                  {categoriasComp.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.nome}{c.descricao ? ` — ${c.descricao}` : ''}</option>
                  ))}
                </select>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {form.complemento_ids.length} selecionado(s)
              </span>
            </div>

            {complementoFiltrado.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400">
                Nenhum complemento cadastrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {complementoFiltrado.map((c) => {
                  const ativo = form.complemento_ids.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleComplemento(c.id)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition"
                      style={
                        ativo
                          ? { background: 'rgba(22,163,74,.08)', border: '1.5px solid var(--green)' }
                          : { background: 'white', border: '1px solid #E5E7EB' }
                      }
                    >
                      <div
                        className="size-5 rounded-md flex items-center justify-center shrink-0"
                        style={
                          ativo
                            ? { background: 'var(--green)' }
                            : { border: '1.5px solid #D1D5DB' }
                        }
                      >
                        {ativo && <Check size={12} color="white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{c.nome}</div>
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {formatCurrency(Number(c.preco))}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardSection>

          {/* ====== CARD 11: Matéria-prima / Ingredientes ====== */}
          <CardSection title="Ingredientes / Matéria-prima" icon={Package}>
            <p className="text-sm text-gray-500 mb-3 -mt-1">
              Vincule os ingredientes que entram na montagem deste produto.
              Cadastre os ingredientes em <strong>Estoque → Matéria-prima</strong>.
              <br />
              <span className="text-xs text-gray-400">
                Ao confirmar um pedido, o estoque baixa automaticamente (quantidade por unidade × qtd pedida).
              </span>
            </p>

            {insumos.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400">
                Nenhum ingrediente cadastrado ainda.
                Vá em <strong>Estoque → Matéria-prima</strong> para cadastrar.
              </div>
            ) : (
              <div className="space-y-3">
                {form.ingredientes.map((ing, idx) => {
                  const insumo = insumos.find((i) => i.id === ing.insumo_id)
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border"
                      style={{ borderColor: '#E5E7EB' }}
                    >
                      <select
                        value={ing.insumo_id}
                        onChange={(e) => {
                          const copy = [...form.ingredientes]
                          copy[idx] = { ...copy[idx], insumo_id: e.target.value }
                          setForm({ ...form, ingredientes: copy })
                        }}
                        className="form-input flex-1"
                      >
                        <option value="">Selecione ingrediente...</option>
                        {insumos.map((i) => (
                          <option key={i.id} value={i.id}>{i.nome}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.001"
                          value={ing.quantidade}
                          onChange={(e) => {
                            const copy = [...form.ingredientes]
                            copy[idx] = { ...copy[idx], quantidade: e.target.value }
                            setForm({ ...form, ingredientes: copy })
                          }}
                          placeholder="0"
                          className="form-input w-24 text-right"
                        />
                        <span className="hint text-sm">
                          {insumo?.unidade || ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const copy = form.ingredientes.filter((_, i) => i !== idx)
                          setForm({ ...form, ingredientes: copy })
                        }}
                        className="size-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-600 shrink-0"
                        title="Remover ingrediente"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}

                <button
                  type="button"
                  onClick={() => {
                    setForm({
                      ...form,
                      ingredientes: [
                        ...form.ingredientes,
                        { insumo_id: '', quantidade: '' },
                      ],
                    })
                  }}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-2xl text-sm font-medium text-gray-500 hover:border-green-500 hover:text-green-700 hover:bg-green-50 transition flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  Adicionar ingrediente
                </button>

                {custoCalculado() > 0 && (
                  <div className="bg-green-50 rounded-2xl p-3 flex items-center justify-between border border-green-200">
                    <div className="text-sm text-gray-700">
                      <strong>Custo total por unidade:</strong> soma dos ingredientes vinculados.
                    </div>
                    <div className="text-base font-bold text-green-700">
                      {formatCurrency(custoCalculado())}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardSection>
        </div>

        {/* ============ FOOTER ============ */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t bg-white" style={{ borderColor: 'var(--line-strong)' }}>
          <div className="flex-1">
            {erro && (
              <div className="text-sm text-red-600 flex items-center gap-1.5">
                <Info size={14} />
                {erro}
              </div>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost" disabled={salvando}>
            Cancelar
          </button>
          <button onClick={salvar} className="btn-primary" disabled={salvando}>
            <Save size={14} />
            {salvando ? 'Salvando...' : 'Salvar item'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ===========================================================
   COMPONENTES AUXILIARES
   =========================================================== */
function CardSection({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon size={16} style={{ color: 'var(--green)' }} />}
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, required, hint, children, className }: any) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {hint && <span className="text-gray-400 font-normal ml-1">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function ToggleLinha({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {hint && <div className="text-xs text-gray-500">{hint}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-11 h-6 rounded-full transition relative shrink-0"
      style={{ background: checked ? 'var(--green)' : '#D1D5DB' }}
    >
      <div
        className="size-5 rounded-full bg-white absolute top-0.5 transition-all shadow"
        style={{ left: checked ? '22px' : '2px' }}
      />
    </button>
  )
}

function ToggleCanal({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="px-4 py-3 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
      style={
        checked
          ? { background: 'rgba(22,163,74,.08)', border: '1.5px solid var(--green)', color: '#15803D' }
          : { background: 'white', border: '1px solid #D1D5DB', color: '#6B7280' }
      }
    >
      <div
        className="size-4 rounded-full border-2 flex items-center justify-center"
        style={{ borderColor: checked ? 'var(--green)' : '#D1D5DB' }}
      >
        {checked && <div className="size-2 rounded-full" style={{ background: 'var(--green)' }} />}
      </div>
      {label}
    </button>
  )
}

function ImageUploader({ value, onChange }: { value: string; onChange: (url: string, path?: string) => void }) {
  const [drag, setDrag] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState('')

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErro('Selecione uma imagem.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErro('Máx 5MB.')
      return
    }
    const dimensoes = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image()
      image.onload = () => { URL.revokeObjectURL(image.src); resolve({ width: image.naturalWidth, height: image.naturalHeight }) }
      image.onerror = reject
      image.src = URL.createObjectURL(file)
    })
    if (dimensoes.width !== 1080 || dimensoes.height !== 1080) {
      setErro(`A foto do produto deve ter exatamente 1080×1080 px. Esta imagem tem ${dimensoes.width}×${dimensoes.height} px.`)
      return
    }
    setErro('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload-produto', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro no upload')
      onChange(data.url, data.path)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setUploading(false)
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="Produto" className="size-32 rounded-2xl object-contain bg-gray-50" style={{ border: '1px solid #E5E7EB' }} />
        <div className="flex-1">
          <button
            type="button"
            onClick={() => onChange('', '')}
            className="text-sm text-red-600 hover:underline flex items-center gap-1"
          >
            <Trash2 size={14} />
            Remover imagem
          </button>
          <p className="text-xs text-gray-500 mt-2">JPG, PNG, WebP ou GIF • Máx 5MB</p>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ou cole uma URL: https://..."
            className="form-input mt-2"
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          const f = e.dataTransfer.files?.[0]
          if (f) handleFile(f)
        }}
        className="rounded-2xl p-8 text-center cursor-pointer transition block"
        style={{
          border: drag ? '2px dashed var(--green)' : '2px dashed #D1D5DB',
          background: drag ? 'rgba(22,163,74,.04)' : '#FAFAFA',
        }}
      >
        {uploading ? (
          <div className="w-8 h-8 mx-auto border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Upload size={28} className="mx-auto mb-2" style={{ color: '#9CA3AF' }} />
            <p className="text-sm font-medium text-gray-700">Arraste a imagem ou clique aqui</p>
            <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP ou GIF • Máx 5MB</p>
          </>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
      </label>
      <input
        className="form-input mt-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ou cole uma URL: https://..."
      />
      {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
    </div>
  )
}

