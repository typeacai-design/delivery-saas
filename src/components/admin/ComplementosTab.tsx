'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import { formatCurrency } from '@/lib/utils'
import {
  Plus, Edit, Trash2, Search, X, Save, Upload, Image as ImageIcon,
  Check, Layers, Box, AlertCircle, Copy, ArrowRight
} from 'lucide-react'

type Lista = {
  id: string
  nome: string
  descricao: string | null
  ordem: number
  qtd_minima: number
  qtd_maxima: number
  max_um_de_cada: boolean
  imagem_url: string | null
  ativo: boolean
}

type Complemento = {
  id: string
  categoria_id: string | null
  nome: string
  descricao: string | null
  preco: number
  custo: number
  ordem: number
  qtd_max: number
  etiqueta1: string | null
  etiqueta2: string | null
  etiqueta3: string | null
  controlar_estoque: boolean
  quantidade_estoque: number
  imagem_url: string | null
  imagem_path?: string | null
  ativo: boolean
}
export default function ComplementosTab() {
  const [listas, setListas] = useState<Lista[]>([])
  const [complementos, setComplementos] = useState<Complemento[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [showListaModal, setShowListaModal] = useState(false)
  const [showCompModal, setShowCompModal] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [cloneSourceLista, setCloneSourceLista] = useState<Lista | null>(null)
  const [editingLista, setEditingLista] = useState<Lista | null>(null)
  const [editingComp, setEditingComp] = useState<Complemento | null>(null)
  const [compParaNovaListaId, setCompParaNovaListaId] = useState<string>('')
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const tid = await activeTenantId()
    if (!tid) { setLoading(false); return }

    const { data: l } = await supabase
      .from('categorias_complementos')
      .select('*')
      .eq('tenant_id', tid)
      .order('ordem')
    setListas(l || [])

    const { data: c } = await supabase
      .from('complementos')
      .select('*')
      .eq('tenant_id', tid)
      .order('ordem')
    setComplementos(c || [])

    setLoading(false)
  }

  const normalizar = (texto: string) => {
    if (!texto) return ''
    return texto
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
  }

  // Normalizar texto para busca
  const textoNormalizado = (texto: string) => {
    if (!texto) return ''
    return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  }

  const compsPorLista = (listaId: string) => {
    return complementos.filter((c) => {
      if (c.categoria_id !== listaId) return false
      // Busca: qualquer quantidade de caracteres, busca no nome E descrição
      if (busca && busca.trim().length > 0) {
        const termo = textoNormalizado(busca.trim())
        const nome = textoNormalizado(c.nome || '')
        const desc = textoNormalizado(c.descricao || '')
        return nome.includes(termo) || desc.includes(termo)
      }
      return true
    })
  }

  const listasFiltradas = listas.filter((l) => {
    if (filtroGrupo && l.id !== filtroGrupo) return false
    if (filtroStatus === 'ativos' && !l.ativo) return false
    if (filtroStatus === 'inativos' && l.ativo) return false

    // Se há busca, mostrar lista se nome/desc correspondem OU se contém complementos que correspondem
    if (busca && busca.trim().length > 0) {
      const termo = textoNormalizado(busca.trim())
      const nomeMatch = textoNormalizado(l.nome || '').includes(termo)
      const descMatch = textoNormalizado(l.descricao || '').includes(termo)

      // Se a busca corresponde ao nome da lista, mostrar
      if (nomeMatch || descMatch) return true

      // Se a lista contém complementos que correspondem, mostrar
      const compsDaLista = complementos.filter(c => c.categoria_id === l.id)
      const temComplementoMatch = compsDaLista.some(c => {
        const nome = textoNormalizado(c.nome || '')
        const desc = textoNormalizado(c.descricao || '')
        return nome.includes(termo) || desc.includes(termo)
      })
      return temComplementoMatch
    }
    return true
  })

  const temListas = listas.length > 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: '#E5E7EB' }}>
        <div>
          <div className="text-xs text-gray-500 mb-1">Adicionais</div>
          <h2 className="text-lg font-semibold text-gray-900">Listas de Complementos</h2>
        </div>
        <button
          onClick={() => { setEditingLista(null); setShowListaModal(true) }}
          className="btn-primary"
        >
          <Plus size={14} />
          Criar Lista de complemento
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap gap-3" style={{ borderColor: '#E5E7EB' }}>
        <select
          value={filtroGrupo}
          onChange={(e) => setFiltroGrupo(e.target.value)}
          className="form-input flex-1 min-w-[180px]"
        >
          <option value="">Filtrar listas — Exibir todas</option>
          {listas.map((l) => (
            <option key={l.id} value={l.id}>{l.nome}</option>
          ))}
        </select>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="form-input flex-1 min-w-[180px]"
        >
          <option value="todos">Filtrar Ativos/Inativos</option>
          <option value="ativos">Apenas ativos</option>
          <option value="inativos">Apenas inativos</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Busca por nome/descrição"
            className="form-input pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Carregando...</div>
      ) : !temListas ? (
        <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: '#E5E7EB' }}>
          <div className="size-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,.14)' }}>
            <AlertCircle size={28} className="text-amber-700" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Vamos começar!</h3>
          <p className="text-gray-500 mb-5 max-w-sm mx-auto">
            Crie uma lista de complementos (Ex: Adicione Frutas, Escolha os Acompanhamentos) e adicione itens a ela.
          </p>
          <button
            onClick={() => { setEditingLista(null); setShowListaModal(true) }}
            className="btn-primary"
          >
            <Plus size={14} />
            Criar primeira lista
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {listasFiltradas.map((lista) => {
            const items = compsPorLista(lista.id)
            return (
              <div key={lista.id} className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
                {/* Header da lista */}
                <div className="bg-gray-50 px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b" style={{ borderColor: '#E5E7EB' }}>
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{lista.nome}</h3>
                      <button
                        onClick={() => { setEditingLista(lista); setShowListaModal(true) }}
                        className="text-gray-400 hover:text-gray-700"
                      >
                        <Edit size={12} />
                      </button>
                    </div>
                    {lista.descricao && (
                      <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1 inline-block">
                        💡 {lista.descricao}
                      </p>
                    )}
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                      <span>Min: <strong>{lista.qtd_minima}</strong> • Max: <strong>{lista.qtd_maxima}</strong></span>
                      <span>{items.length} complemento{items.length !== 1 ? 's' : ''}</span>
                      {!lista.ativo && (
                        <span className="text-red-600">Pausado</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setCloneSourceLista(lista); setShowCloneModal(true) }}
                      className="px-4 py-2 border border-amber-500 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-50 flex items-center gap-1.5"
                      title="Clonar esta lista"
                    >
                      <Copy size={14} />
                      Clonar
                    </button>
                    <button
                      onClick={() => { setEditingLista(lista); setShowListaModal(true) }}
                      className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800"
                    >
                      Editar Lista
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('Excluir esta lista?')) return
                        await supabase.from('categorias_complementos').update({ ativo: false }).eq('id', lista.id)
                        loadData()
                      }}
                      className="px-3 py-2 text-red-600 border border-red-300 rounded-xl text-sm font-medium hover:bg-red-50"
                    >
                      Excluir
                    </button>
                    <button
                      onClick={() => {
                        setEditingComp(null)
                        setCompParaNovaListaId(lista.id)
                        setShowCompModal(true)
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700"
                    >
                      <Plus size={14} className="inline mr-1" />
                      Adicionar complemento
                    </button>
                  </div>
                </div>

                {/* Tabela de complementos */}
                {items.length > 0 ? (
                  <table className="w-full">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="text-left px-5 py-3">Img</th>
                        <th className="text-left px-5 py-3">Nome</th>
                        <th className="text-left px-5 py-3">Valor</th>
                        <th className="text-left px-5 py-3">Estoque</th>
                        <th className="text-left px-5 py-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((c) => {
                        const out = c.controlar_estoque && c.quantidade_estoque <= 0
                        return (
                          <tr key={c.id} className="border-t" style={{ borderColor: '#F3F4F6' }}>
                            <td className="px-5 py-3">
                              <div className="size-9 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                                {c.imagem_url ? (
                                  <img src={c.imagem_url} alt={c.nome} className="size-9 object-cover" />
                                ) : (
                                  <ImageIcon size={14} className="text-gray-400" />
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">{c.nome}</span>
                                <button onClick={() => { setEditingComp(c); setShowCompModal(true) }} className="text-gray-400 hover:text-gray-700">
                                  <Edit size={11} />
                                </button>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-sm">
                              <span className="font-medium text-gray-900">{formatCurrency(Number(c.preco))}</span>
                              <button onClick={() => { setEditingComp(c); setShowCompModal(true) }} className="text-gray-400 hover:text-gray-700 ml-2">
                                <Edit size={11} />
                              </button>
                            </td>
                            <td className="px-5 py-3">
                              <span className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-700">
                                {c.controlar_estoque ? `Em estoque: ${c.quantidade_estoque}` : 'Sempre disponível'}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => { setEditingComp(c); setShowCompModal(true) }}
                                  className="px-3 py-1 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm('Excluir este complemento?')) return
                                    await supabase.from('complementos').update({ ativo: false }).eq('id', c.id)
                                    loadData()
                                  }}
                                  className="px-2 py-1 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                                >
                                  <Trash2 size={12} />
                                </button>
                                <Switch
                                  checked={c.ativo}
                                  onChange={async (v) => {
                                    await supabase.from('complementos').update({ ativo: v }).eq('id', c.id)
                                    loadData()
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-5 py-6 text-center text-sm text-gray-500">
                    Nenhum complemento nesta lista. Clique em "Adicionar complemento" para começar.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showListaModal && (
        <ListaModal
          lista={editingLista}
          listas={listas}
          onClose={() => { setShowListaModal(false); setEditingLista(null) }}
          onSaved={loadData}
        />
      )}

      {showCompModal && (
        <ComplementoModal
          comp={editingComp}
          listas={listas}
          defaultCategoriaId={editingComp?.categoria_id || compParaNovaListaId || listas[0]?.id || ''}
          todosComplementos={complementos}
          onClose={() => {
            setShowCompModal(false)
            setEditingComp(null)
            setCompParaNovaListaId('')
          }}
          onSaved={loadData}
        />
      )}

      {showCloneModal && cloneSourceLista && (
        <CloneListaModal
          sourceLista={cloneSourceLista}
          listas={listas}
          complementos={complementos}
          onClose={() => {
            setShowCloneModal(false)
            setCloneSourceLista(null)
          }}
          onSaved={loadData}
        />
      )}
    </div>
  )
}

/* ===========================================================
   MODAL: Clonar Lista de Complementos
   =========================================================== */
function CloneListaModal({
  sourceLista,
  listas,
  complementos,
  onClose,
  onSaved,
}: {
  sourceLista: Lista
  listas: Lista[]
  complementos: Complemento[]
  onClose: () => void
  onSaved: () => void
}) {
  const [nome, setNome] = useState(`${sourceLista.nome} (cópia)`)
  const [descricao, setDescricao] = useState(sourceLista.descricao || '')
  const [qtd_minima, setQtd_minima] = useState(String(sourceLista.qtd_minima))
  const [qtd_maxima, setQtd_maxima] = useState(String(sourceLista.qtd_maxima))
  const [max_um_de_cada, setMax_um_de_cada] = useState(sourceLista.max_um_de_cada)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const supabase = createClient()

  const compsDaLista = complementos.filter((c) => c.categoria_id === sourceLista.id)

  const salvar = async () => {
    if (!nome.trim()) {
      setErro('Informe o nome da nova lista.')
      return
    }
    setSalvando(true)
    setErro('')
    const tid = await activeTenantId()
    if (!tid) { setSalvando(false); return }

    const num = (v: string, def: number) => (v === '' ? def : parseInt(v, 10))

    // Criar nova lista
    const { data: novaLista, error: erroLista } = await supabase
      .from('categorias_complementos')
      .insert({
        tenant_id: tid,
        nome: nome.trim(),
        descricao: descricao || null,
        qtd_minima: num(qtd_minima, 0),
        qtd_maxima: num(qtd_maxima, 1),
        max_um_de_cada,
        ativo: true,
        ordem: listas.length,
      })
      .select('id')
      .single()

    if (erroLista || !novaLista?.id) {
      setErro('Erro ao criar lista: ' + (erroLista?.message || 'desconhecido'))
      setSalvando(false)
      return
    }

    // Clonar complementos da lista original
    if (compsDaLista.length > 0) {
      const compsClonados = compsDaLista.map((c) => ({
        tenant_id: tid,
        categoria_id: novaLista.id,
        nome: c.nome,
        descricao: c.descricao,
        preco: c.preco,
        custo: c.custo,
        ordem: c.ordem,
        qtd_max: c.qtd_max,
        etiqueta1: c.etiqueta1,
        etiqueta2: c.etiqueta2,
        etiqueta3: c.etiqueta3,
        controlar_estoque: c.controlar_estoque,
        quantidade_estoque: c.quantidade_estoque,
        ativo: c.ativo,
        imagem_url: c.imagem_url,
        imagem_path: c.imagem_path,
      }))

      const { error: erroComps } = await supabase
        .from('complementos')
        .insert(compsClonados)

      if (erroComps) {
        setErro(`Lista criada, mas houve erro ao clonar complementos: ${erroComps.message}`)
        setSalvando(false)
        return
      }
    }

    setSalvando(false)
    onSaved()
    onClose()
  }

  return (
    <ModalShell title={`Clonar lista: ${sourceLista.nome}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <ArrowRight size={20} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Esta ação vai duplicar a lista <strong>"{sourceLista.nome}"</strong> com todos os seus {compsDaLista.length} complemento(s).
            </p>
            <p className="text-xs text-amber-600 mt-1">
              A cópia será criada como nova lista ativa.
            </p>
          </div>
        </div>

        <Field label="Nome da nova lista" required>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder='Ex: "Adicione Frutas (cópia)"'
            className="form-input"
            autoFocus
          />
        </Field>

        <Field label="Descrição">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição interna (opcional)"
            className="form-input"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Qtd mínima">
            <input
              type="number"
              min={0}
              value={qtd_minima}
              onChange={(e) => setQtd_minima(e.target.value)}
              className="form-input"
            />
          </Field>
          <Field label="Qtd máxima">
            <input
              type="number"
              min={1}
              value={qtd_maxima}
              onChange={(e) => setQtd_maxima(e.target.value)}
              className="form-input"
            />
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={max_um_de_cada}
              onChange={(e) => setMax_um_de_cada(e.target.checked)}
              className="size-4 rounded border-gray-300 text-green-600"
            />
            Permitir no máximo uma unidade de cada complemento
          </label>
        </div>

        {erro && (
          <div className="text-sm text-red-600 flex items-center gap-2 bg-red-50 p-3 rounded-lg">
            <AlertCircle size={16} />
            {erro}
          </div>
        )}
      </div>

      <ModalFooter onClose={onClose} onSave={salvar} salvando={salvando} saveLabel="Clonar lista" />
    </ModalShell>
  )
}

/* ===========================================================
   MODAL: Lista de Complementos
   =========================================================== */
function ListaModal({ lista, listas, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    nome: lista?.nome || '',
    descricao: lista?.descricao || '',
    qtd_minima: lista?.qtd_minima != null ? String(lista.qtd_minima) : '',
    qtd_maxima: lista?.qtd_maxima != null ? String(lista.qtd_maxima) : '',
    max_um_de_cada: lista?.max_um_de_cada ?? false,
    ativo: lista?.ativo ?? true,
  })
  const [salvando, setSalvando] = useState(false)
  const supabase = createClient()

  const salvar = async () => {
    if (!form.nome.trim()) return
    setSalvando(true)
    const tid = await activeTenantId()
    if (!tid) { setSalvando(false); return }

    const num = (v: string, def: number) => (v === '' ? def : parseInt(v, 10))

    const payload = {
      nome: form.nome,
      descricao: form.descricao || null,
      qtd_minima: num(form.qtd_minima, 0),
      qtd_maxima: num(form.qtd_maxima, 1),
      max_um_de_cada: form.max_um_de_cada,
      ativo: form.ativo,
    }

    if (lista) {
      await supabase.from('categorias_complementos').update(payload).eq('id', lista.id)
    } else {
      await supabase.from('categorias_complementos').insert({
        ...payload,
        tenant_id: tid,
        ordem: listas.length,
      })
    }
    setSalvando(false)
    onSaved()
    onClose()
  }

  return (
    <ModalShell title={lista ? 'Editar Lista de Complementos' : 'Criar Nova Lista de Complementos'} onClose={onClose}>
      <div className="space-y-4">
        <h3 className="text-red-600 font-semibold text-sm">Configurações da lista</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Nome" required className="md:col-span-3">
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder='Ex: "Adicione Frutas"'
              className="form-input"
              autoFocus
            />
          </Field>
          <Field label="Qtd mínima" required>
            <input
              type="number"
              min={0}
              value={form.qtd_minima}
              onChange={(e) => setForm({ ...form, qtd_minima: e.target.value })}
              className="form-input"
              placeholder="0"
            />
          </Field>
          <Field label="Qtd máxima" required>
            <input
              type="number"
              min={1}
              value={form.qtd_maxima}
              onChange={(e) => setForm({ ...form, qtd_maxima: e.target.value })}
              className="form-input"
              placeholder="1"
            />
          </Field>
        </div>
        <Field label="Descrição" hint="(invisível no cardápio, use para identificação interna)">
          <input
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="form-input"
          />
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={form.max_um_de_cada}
              onChange={(e) => setForm({ ...form, max_um_de_cada: e.target.checked })}
              className="size-4 rounded border-gray-300 text-green-600"
            />
            Permitir no máximo uma unidade de cada complemento
          </label>
        </div>
      </div>

      <ModalFooter
        onClose={onClose}
        onSave={salvar}
        salvando={salvando}
        saveLabel={lista ? 'Salvar alterações' : 'Criar lista'}
      />
    </ModalShell>
  )
}

/* ===========================================================
   MODAL: Complemento
   =========================================================== */
function ComplementoModal({ comp, listas, defaultCategoriaId, onClose, onSaved, todosComplementos }: any) {
  const [form, setForm] = useState({
    nome: comp?.nome || '',
    categoria_id: comp?.categoria_id || defaultCategoriaId,
    preco: comp ? String(comp.preco) : '',
    ordem: comp?.ordem != null ? String(comp.ordem) : '',
    qtd_max: comp?.qtd_max != null ? String(comp.qtd_max) : '',
    custo: comp?.custo != null ? String(comp.custo) : '',
    descricao: comp?.descricao || '',
    etiqueta1: comp?.etiqueta1 || '',
    etiqueta2: comp?.etiqueta2 || '',
    etiqueta3: comp?.etiqueta3 || '',
    controlar_estoque: comp?.controlar_estoque ?? false,
    quantidade_estoque: comp?.quantidade_estoque != null ? String(comp.quantidade_estoque) : '',
    ativo: comp?.ativo ?? true,
    imagem_url: comp?.imagem_url || '',
    imagem_path: comp?.imagem_path || '',
  })
  const [salvando, setSalvando] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState('')
  const supabase = createClient()

  // Valida se já existe outro complemento com a mesma ordem na mesma lista
  const validarOrdemDuplicada = (novaOrdem: number, listaId: string, compId: string | undefined) => {
    const mesmaLista = todosComplementos?.filter((c: Complemento) => c.categoria_id === listaId) || []
    const duplicado = mesmaLista.find((c: Complemento) =>
      c.ordem === novaOrdem && c.id !== compId
    )
    return duplicado ? `Já existe "${duplicado.nome}" com ordem ${novaOrdem} nesta lista.` : null
  }

  const salvar = async () => {
    if (!form.nome.trim()) {
      setErro('Informe o nome do complemento.')
      return
    }
    setSalvando(true)
    const tid = await activeTenantId()
    if (!tid) { setSalvando(false); return }

    const num = (v: string, def: number) => (v === '' ? def : parseFloat(v))
    const intNum = (v: string, def: number) => (v === '' ? def : parseInt(v, 10))
    const ordemNum = intNum(form.ordem, 0)

    // Validação de ordem duplicada
    const erroOrdem = validarOrdemDuplicada(ordemNum, form.categoria_id, comp?.id)
    if (erroOrdem) {
      setErro(erroOrdem)
      setSalvando(false)
      return
    }

    const payload = {
      nome: form.nome,
      categoria_id: form.categoria_id || null,
      preco: num(form.preco, 0),
      ordem: ordemNum,
      qtd_max: intNum(form.qtd_max, 99),
      custo: num(form.custo, 0),
      descricao: form.descricao || null,
      etiqueta1: form.etiqueta1 || null,
      etiqueta2: form.etiqueta2 || null,
      etiqueta3: form.etiqueta3 || null,
      controlar_estoque: form.controlar_estoque,
      quantidade_estoque: intNum(form.quantidade_estoque, 0),
      ativo: form.ativo,
      imagem_url: form.imagem_url || null,
      imagem_path: form.imagem_path || null,
    }

    if (comp && comp.id) {
      const { error } = await supabase.from('complementos').update(payload).eq('id', comp.id)
      if (error) { setErro(error.message); setSalvando(false); return }
    } else {
      const { error } = await supabase.from('complementos').insert({
        ...payload,
        tenant_id: tid,
      })
      if (error) {
        alert('Erro ao salvar complemento: ' + error.message)
        setSalvando(false)
        return
      }
    }
    if (comp?.imagem_path && comp.imagem_path !== form.imagem_path) {
      await fetch(`/api/upload-complemento?path=${encodeURIComponent(comp.imagem_path)}`, { method: 'DELETE' })
    }
    // Pequeno delay pra garantir propagação no Supabase antes de refetch
    await new Promise((r) => setTimeout(r, 200))
    setSalvando(false)
    onSaved()
    onClose()
  }

  return (
    <ModalShell
      title={comp && comp.id ? 'Editar Complemento' : 'Novo Complemento'}
      onClose={onClose}
    >
      <Field label="Imagem do complemento" hint="JPG, PNG ou WebP, ate 5MB">
        <div className="flex items-center gap-4">
          <button type="button" disabled={uploading} onClick={() => document.getElementById('complemento-image-input')?.click()} className="size-28 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-white" style={{ borderColor: '#D1D5DB' }}>
            {form.imagem_url ? <img src={form.imagem_url} alt="Preview do complemento" className="size-full object-cover" /> : uploading ? <span className="text-xs text-gray-500">Enviando...</span> : <Upload size={24} className="text-gray-400" />}
          </button>
          <div>
            <button type="button" className="px-3 py-2 border rounded-xl text-sm bg-white" onClick={() => document.getElementById('complemento-image-input')?.click()}>{form.imagem_url ? 'Substituir imagem' : 'Enviar imagem'}</button>
            {form.imagem_url && <button type="button" className="block mt-2 text-sm text-red-600" onClick={async () => {
              setForm({ ...form, imagem_url: '', imagem_path: '' })
            }}>Remover imagem</button>}
          </div>
          <input id="complemento-image-input" type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={async (e) => {
            const file = e.target.files?.[0]; e.currentTarget.value = ''
            if (!file) return
            setUploading(true); setErro('')
            try {
              const body = new FormData(); body.append('file', file)
              const response = await fetch('/api/upload-complemento', { method: 'POST', body })
              const result = await response.json()
              if (!response.ok) throw new Error(result.error || 'Erro no upload')
              setForm({ ...form, imagem_url: result.url, imagem_path: result.path })
            } catch (e: any) { setErro(e.message) } finally { setUploading(false) }
          }} />
        </div>
        {erro && <p className="text-sm text-red-600 mt-2">{erro}</p>}
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="Nome" required>
          <input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex: Banana"
            className="form-input"
            autoFocus
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
              className="form-input pl-10"
              placeholder="0,00"
            />
          </div>
        </Field>
        <Field label="Ordem">
          <input
            type="number"
            value={form.ordem}
            onChange={(e) => setForm({ ...form, ordem: e.target.value })}
            className="form-input"
            placeholder="0"
          />
        </Field>
        <Field label="Qtd max.">
          <input
            type="number"
            min={0}
            value={form.qtd_max}
            onChange={(e) => setForm({ ...form, qtd_max: e.target.value })}
            className="form-input"
            placeholder="99"
          />
        </Field>
        <Field label="Custo" hint="(relatório de lucratividade)">
          <input
            type="number"
            step="0.01"
            value={form.custo}
            onChange={(e) => setForm({ ...form, custo: e.target.value })}
            className="form-input"
            placeholder="0,00"
          />
        </Field>
        <Field label="Lista" className="md:col-span-3">
          <select
            value={form.categoria_id}
            onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
            className="form-input"
          >
            <option value="">Selecione...</option>
            {listas.map((l: any) => (
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Descrição" hint="(invisível no cardápio)">
        <textarea
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          rows={2}
          className="form-input"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Etiqueta 1">
          <input
            value={form.etiqueta1}
            onChange={(e) => setForm({ ...form, etiqueta1: e.target.value })}
            placeholder="Ex: Vegano"
            className="form-input"
          />
        </Field>
        <Field label="Etiqueta 2">
          <input
            value={form.etiqueta2}
            onChange={(e) => setForm({ ...form, etiqueta2: e.target.value })}
            placeholder="Ex: Sem glúten"
            className="form-input"
          />
        </Field>
        <Field label="Etiqueta 3">
          <input
            value={form.etiqueta3}
            onChange={(e) => setForm({ ...form, etiqueta3: e.target.value })}
            placeholder="Ex: Orgânico"
            className="form-input"
          />
        </Field>
      </div>

      <Field label="Estoque">
        <div className="flex items-center gap-3">
          <TogglePill
            label="Sempre disponível"
            ativo={!form.controlar_estoque}
            onClick={() => setForm({ ...form, controlar_estoque: false })}
          />
          <TogglePill
            label="Controlar qtd"
            ativo={form.controlar_estoque}
            onClick={() => setForm({ ...form, controlar_estoque: true })}
          />
          {form.controlar_estoque && (
            <input
              type="number"
              min={0}
              value={form.quantidade_estoque}
              onChange={(e) => setForm({ ...form, quantidade_estoque: e.target.value })}
              className="form-input w-24"
              placeholder="0"
            />
          )}
        </div>
      </Field>

      <ModalFooter
        onClose={onClose}
        onSave={salvar}
        salvando={salvando}
        saveLabel={comp && comp.id ? 'Salvar' : 'Criar'}
      />
    </ModalShell>
  )
}

/* ===========================================================
   COMPONENTES AUXILIARES
   =========================================================== */
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto" style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: 'calc(100vh - 48px)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E5E7EB' }}>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50 space-y-4">{children}</div>
      </div>
    </div>
  )
}

function ModalFooter({ onClose, onSave, salvando, saveLabel }: any) {
  return (
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-white rounded-b-2xl" style={{ borderColor: '#E5E7EB' }}>
      <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50" disabled={salvando}>
        Fechar
      </button>
      <button
        onClick={onSave}
        className="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 flex items-center gap-1.5"
        disabled={salvando}
      >
        <Save size={14} />
        {salvando ? 'Salvando...' : saveLabel}
      </button>
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

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-10 h-5 rounded-full transition relative shrink-0"
      style={{ background: checked ? '#16A34A' : '#D1D5DB' }}
    >
      <div
        className="size-4 rounded-full bg-white absolute top-0.5 transition-all shadow"
        style={{ left: checked ? '20px' : '2px' }}
      />
    </button>
  )
}

function TogglePill({ label, ativo, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 rounded-lg text-sm font-medium transition"
      style={
        ativo
          ? { background: 'var(--green)', color: 'white' }
          : { background: 'white', color: '#374151', border: '1px solid #D1D5DB' }
      }
    >
      {label}
    </button>
  )
}

