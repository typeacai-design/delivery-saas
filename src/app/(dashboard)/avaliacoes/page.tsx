'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Star, Check, X, MessageCircle, Trash2, Send, ThumbsUp, ThumbsDown, Filter, ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { activeTenantId } from '@/lib/active-tenant-client'

type Avaliacao = {
  id: string
  pedido_id: string | null
  cliente_nome: string | null
  cliente_whatsapp: string | null
  nota: number
  comentario: string | null
  aprovado: boolean
  resposta_admin: string | null
  created_at: string
}

export default function AvaliacoesPage() {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendentes' | 'aprovadas' | 'rejeitadas'>('todas')
  const [filtroNota, setFiltroNota] = useState<number | null>(null)
  const [respostaOpen, setRespostaOpen] = useState<string | null>(null)
  const [respostaTexto, setRespostaTexto] = useState('')
  const [showFiltrosAvancados, setShowFiltrosAvancados] = useState(false)
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const tid=await activeTenantId();if(!tid){setLoading(false);return}
    const { data } = await supabase
      .from('avaliacoes')
      .select('*')
      .eq('tenant_id', tid)
      .order('created_at', { ascending: false })
    if (data) setAvaliacoes(data)
    setLoading(false)
  }

  const setAprovado = async (id: string, aprovado: boolean) => {
    await supabase.from('avaliacoes').update({ aprovado }).eq('id', id)
    loadData()
  }

  const deletar = async (id: string) => {
    if (!confirm('Excluir esta avaliação?')) return
    await supabase.from('avaliacoes').delete().eq('id', id)
    loadData()
  }

  const salvarResposta = async (id: string) => {
    if (!respostaTexto.trim()) return
    await supabase.from('avaliacoes').update({ resposta_admin: respostaTexto }).eq('id', id)
    setRespostaOpen(null)
    setRespostaTexto('')
    loadData()
  }

  const enviarWhatsApp = (avaliacao: Avaliacao) => {
    const msg = `Olá ${avaliacao.cliente_nome || 'cliente'}! Vi sua avaliação de ${avaliacao.nota}⭐ e gostaria de agradecer pelo seu feedback!`
    const phone = avaliacao.cliente_whatsapp?.replace(/\D/g, '') || ''
    if (phone) {
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    }
  }

  // Stats
  const totalAvaliacoes = avaliacoes.length
  const media = avaliacoes.length > 0
    ? Math.round((avaliacoes.reduce((acc, a) => acc + a.nota, 0) / avaliacoes.length) * 10) / 10
    : 0
  const pendentes = avaliacoes.filter((a) => !a.aprovado).length
  const aprovadas = avaliacoes.filter((a) => a.aprovado).length

  // Distribuição
  const distribuicao = [5, 4, 3, 2, 1].map((n) => ({
    estrelas: n,
    count: avaliacoes.filter((a) => a.nota === n).length,
  }))

  // Filtrar
  let filtrados = [...avaliacoes]
  if (filtroStatus === 'pendentes') filtrados = filtrados.filter((a) => !a.aprovado)
  if (filtroStatus === 'aprovadas') filtrados = filtrados.filter((a) => a.aprovado)
  if (filtroStatus === 'rejeitadas') filtrados = filtrados.filter((a) => !a.aprovado && a.resposta_admin)
  if (filtroNota !== null) filtrados = filtrados.filter((a) => a.nota === filtroNota)

  const getNotaLabel = (nota: number) => {
    if (nota === 5) return { label: 'Excelente', color: 'bg-green-100 text-green-700', emoji: '🌟' }
    if (nota === 4) return { label: 'Ótimo', color: 'bg-emerald-100 text-emerald-700', emoji: '😊' }
    if (nota === 3) return { label: 'Regular', color: 'bg-yellow-100 text-yellow-700', emoji: '😐' }
    if (nota === 2) return { label: 'Ruim', color: 'bg-orange-100 text-orange-700', emoji: '😕' }
    return { label: 'Péssimo', color: 'bg-red-100 text-red-700', emoji: '😞' }
  }

  const positivos = avaliacoes.filter((a) => a.nota >= 4).length
  const negativos = avaliacoes.filter((a) => a.nota <= 2).length

  return (
    <div>
      {/* Header */}
      <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1 text-xs text-gray-500">
              <Star size={11} /> Reputação
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Avaliações</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gerencie o feedback dos clientes. Aprove para exibir publicamente e responda quando necessário.
            </p>
          </div>
          {pendentes > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-xl">
              <span className="text-xl">🔔</span>
              <div>
                <p className="text-sm font-bold text-orange-700">{pendentes} avaliação{pendentes > 1 ? 'ões' : ''} pendente{pendentes > 1 ? 's' : ''}</p>
                <p className="text-xs text-orange-600">Aguardando sua análise</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cards métrica */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
        {/* Nota média */}
        <div className="bg-white rounded-2xl border p-4 text-center" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center justify-center gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                size={14}
                className={i <= Math.round(media) ? 'text-yellow-500' : 'text-gray-300'}
                fill={i <= Math.round(media) ? '#EAB308' : 'none'}
              />
            ))}
          </div>
          <div className="text-3xl font-bold text-gray-900">{loading ? '...' : media.toFixed(1)}</div>
          <div className="text-xs text-gray-500">Nota média</div>
        </div>

        {/* Total */}
        <div className="bg-white rounded-2xl border p-4 text-center" style={{ borderColor: '#E5E7EB' }}>
          <div className="text-3xl font-bold text-gray-900">{totalAvaliacoes}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>

        {/* Positivos */}
        <div className="bg-white rounded-2xl border p-4 text-center" style={{ borderColor: '#E5E7EB' }}>
          <div className="text-3xl font-bold text-green-600">{positivos}</div>
          <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
            <ThumbsUp size={12} className="text-green-500" />
            Positivas (4-5⭐)
          </div>
        </div>

        {/* Negativos */}
        <div className="bg-white rounded-2xl border p-4 text-center" style={{ borderColor: '#E5E7EB' }}>
          <div className="text-3xl font-bold text-red-600">{negativos}</div>
          <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
            <ThumbsDown size={12} className="text-red-500" />
            Negativas (1-2⭐)
          </div>
        </div>

        {/* Pendentes */}
        <div className="bg-white rounded-2xl border p-4 text-center" style={{ borderColor: '#E5E7EB' }}>
          <div className="text-3xl font-bold text-orange-600">{pendentes}</div>
          <div className="text-xs text-gray-500">Pendentes</div>
        </div>

        {/* Aprovadas */}
        <div className="bg-white rounded-2xl border p-4 text-center" style={{ borderColor: '#E5E7EB' }}>
          <div className="text-3xl font-bold text-green-600">{aprovadas}</div>
          <div className="text-xs text-gray-500">Visíveis</div>
        </div>
      </div>

      {/* Distribuição visual */}
      <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: '#E5E7EB' }}>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Distribuição das Avaliações</h3>
        <div className="space-y-2">
          {distribuicao.map((d) => {
            const pct = totalAvaliacoes > 0 ? Math.round((d.count / totalAvaliacoes) * 100) : 0
            return (
              <div key={d.estrelas} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-20">
                  <span className="text-sm font-medium text-gray-600">{d.estrelas}</span>
                  <Star size={14} className="text-yellow-500" fill="#EAB308" />
                </div>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      d.estrelas >= 4 ? 'bg-green-500' : d.estrelas === 3 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500 w-16 text-right">{d.count} ({pct}%)</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border p-4 mb-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Filter size={14} />
            Filtrar Avaliações
          </h3>
          <button
            onClick={() => setShowFiltrosAvancados(!showFiltrosAvancados)}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            Filtros avançados
            <ChevronDown size={12} className={`transition-transform ${showFiltrosAvancados ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Status */}
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { id: 'todas', label: 'Todas', count: totalAvaliacoes, color: 'bg-gray-600' },
            { id: 'pendentes', label: 'Pendente', count: pendentes, color: 'bg-orange-500' },
            { id: 'aprovadas', label: 'Aprovadas', count: aprovadas, color: 'bg-green-500' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltroStatus(f.id as any)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                filtroStatus === f.id
                  ? `${f.color} text-white shadow-md`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
              <span className={`px-1.5 py-0.5 rounded text-xs ${filtroStatus === f.id ? 'bg-white/20' : 'bg-gray-200'}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filtro por nota */}
        {showFiltrosAvancados && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500 self-center">Por nota:</span>
            {[5, 4, 3, 2, 1].map((n) => (
              <button
                key={n}
                onClick={() => setFiltroNota(filtroNota === n ? null : n)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
                  filtroNota === n ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {n}
                <Star size={12} fill={filtroNota === n ? 'white' : '#EAB308'} className={filtroNota === n ? 'text-white' : 'text-yellow-500'} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        {loading ? (
          <div className="text-center py-12 text-gray-500">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12">
            <Star size={48} className="mx-auto text-gray-200 mb-3" />
            <div className="text-lg font-medium text-gray-700 mb-1">
              {avaliacoes.length === 0 ? 'Nenhuma avaliação ainda' : 'Nenhuma avaliação neste filtro'}
            </div>
            <div className="text-sm text-gray-500">
              {avaliacoes.length === 0
                ? 'Compartilhe seu link com os clientes para receber avaliações'
                : 'Tente ajustar os filtros'}
            </div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
            {filtrados.map((a) => {
              const notaInfo = getNotaLabel(a.nota)
              return (
                <div key={a.id} className={`p-5 hover:bg-gray-50 transition-colors ${!a.aprovado ? 'bg-orange-50/30' : ''}`}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      {/* Badge de nota */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${notaInfo.color}`}>
                          {notaInfo.emoji} {notaInfo.label}
                        </span>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              size={14}
                              className={i <= a.nota ? 'text-yellow-500' : 'text-gray-300'}
                              fill={i <= a.nota ? '#EAB308' : 'none'}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        {!a.aprovado && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                            ⏳ Pendente
                          </span>
                        )}
                        {a.resposta_admin && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                            ✓ Respondida
                          </span>
                        )}
                      </div>

                      {/* Cliente */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                          {(a.cliente_nome || 'C')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{a.cliente_nome || 'Cliente'}</p>
                          {a.cliente_whatsapp && (
                            <p className="text-xs text-gray-500">{a.cliente_whatsapp}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {a.cliente_whatsapp && (
                        <button
                          onClick={() => enviarWhatsApp(a)}
                          className="size-8 rounded-lg hover:bg-green-50 flex items-center justify-center text-green-600"
                          title="Enviar WhatsApp"
                        >
                          <MessageCircle size={14} />
                        </button>
                      )}
                      {a.aprovado ? (
                        <button
                          onClick={() => setAprovado(a.id, false)}
                          className="px-2 py-1 text-xs rounded-lg text-orange-700 border border-orange-300 hover:bg-orange-50"
                        >
                          Ocultar
                        </button>
                      ) : (
                        <button
                          onClick={() => setAprovado(a.id, true)}
                          className="px-3 py-1 text-xs rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-1"
                        >
                          <Check size={12} />
                          Aprovar
                        </button>
                      )}
                      <button
                        onClick={() => deletar(a.id)}
                        className="size-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Comentário */}
                  {a.comentario && (
                    <div className="bg-gray-50 rounded-xl p-4 mb-3">
                      <p className="text-sm text-gray-700 leading-relaxed">"{a.comentario}"</p>
                    </div>
                  )}

                  {/* Resposta */}
                  {a.resposta_admin && (
                    <div className="bg-green-50 rounded-xl p-4 mb-3 border-l-4 border-green-500">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle size={14} className="text-green-600" />
                        <span className="text-xs font-semibold text-green-700">Sua resposta</span>
                      </div>
                      <p className="text-sm text-gray-700">{a.resposta_admin}</p>
                    </div>
                  )}

                  {/* Input de resposta */}
                  {respostaOpen === a.id ? (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <textarea
                        value={respostaTexto}
                        onChange={(e) => setRespostaTexto(e.target.value)}
                        placeholder="Escreva uma resposta pública para o cliente..."
                        rows={3}
                        className="form-input w-full mb-3"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => salvarResposta(a.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
                        >
                          <Send size={14} />
                          Publicar resposta
                        </button>
                        <button
                          onClick={() => { setRespostaOpen(null); setRespostaTexto('') }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setRespostaOpen(a.id); setRespostaTexto(a.resposta_admin || '') }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                      <MessageCircle size={14} />
                      {a.resposta_admin ? 'Editar resposta' : 'Responder avaliação'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 text-center text-xs text-gray-400">
        💡 As avaliações aprovadas são exibidas publicamente no cardápio da sua loja
      </div>
    </div>
  )
}
