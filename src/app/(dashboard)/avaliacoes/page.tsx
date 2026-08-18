'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Star, Check, X, MessageCircle, Trash2, Send, Loader2 } from 'lucide-react'
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
  const [filtro, setFiltro] = useState<'todas' | 'pendentes' | 'aprovadas'>('todas')
  const [respostaOpen, setRespostaOpen] = useState<string | null>(null)
  const [respostaTexto, setRespostaTexto] = useState('')
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

  const filtrados = avaliacoes.filter((a) => {
    if (filtro === 'pendentes') return !a.aprovado
    if (filtro === 'aprovadas') return a.aprovado
    return true
  })

  return (
    <div>
      <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-2 mb-1 text-xs text-gray-500">
          <Star size={11} /> Reputação
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Avaliações</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie o feedback dos clientes. Aprove para exibir publicamente e responda quando necessário.
        </p>
      </div>

      {/* Cards métrica */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-2 mb-2">
            <Star size={18} className="text-yellow-500" fill="#EAB308" />
            <div className="text-xs text-gray-500">Nota média</div>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {loading ? '...' : media.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {totalAvaliacoes} avaliação{totalAvaliacoes !== 1 ? 'ões' : ''}
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E5E7EB' }}>
          <div className="text-xs text-gray-500 mb-2">Distribuição</div>
          <div className="space-y-1">
            {distribuicao.map((d) => (
              <div key={d.estrelas} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right" style={{ color: '#6B7280' }}>{d.estrelas}</span>
                <Star size={10} className="text-yellow-500" fill="#EAB308" />
                <div className="flex-1 h-2 bg-gray-100 rounded">
                  <div
                    className="h-full bg-yellow-400 rounded"
                    style={{
                      width: totalAvaliacoes > 0 ? `${(d.count / totalAvaliacoes) * 100}%` : '0%',
                    }}
                  />
                </div>
                <span className="w-6 text-right" style={{ color: '#9CA3AF' }}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E5E7EB' }}>
          <div className="text-xs text-gray-500 mb-1">Pendentes</div>
          <div className="text-3xl font-bold text-orange-600">{pendentes}</div>
          <div className="text-xs text-gray-500 mt-1">Aguardando aprovação</div>
        </div>

        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E5E7EB' }}>
          <div className="text-xs text-gray-500 mb-1">Aprovadas</div>
          <div className="text-3xl font-bold text-green-600">{aprovadas}</div>
          <div className="text-xs text-gray-500 mt-1">Visíveis publicamente</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border p-4 mb-4 flex gap-2" style={{ borderColor: '#E5E7EB' }}>
        {[
          { id: 'todas', label: 'Todas' },
          { id: 'pendentes', label: 'Pendentes' },
          { id: 'aprovadas', label: 'Aprovadas' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id as any)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition"
            style={
              filtro === f.id
                ? { background: 'var(--green)', color: 'white' }
                : { background: 'white', color: '#374151', border: '1px solid #D1D5DB' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        {loading ? (
          <div className="text-center py-12 text-gray-500">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12">
            <Star size={32} className="mx-auto text-gray-300 mb-3" />
            <div className="text-sm text-gray-500">
              {avaliacoes.length === 0
                ? 'Nenhuma avaliação ainda.'
                : 'Nenhuma avaliação nesse filtro.'}
            </div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
            {filtrados.map((a) => (
              <div key={a.id} className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            size={16}
                            className={i <= a.nota ? 'text-yellow-500' : 'text-gray-300'}
                            fill={i <= a.nota ? '#EAB308' : 'none'}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(a.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      {!a.aprovado && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                          Pendente
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {a.cliente_nome || 'Cliente'}
                      {a.cliente_whatsapp && (
                        <span className="text-xs text-gray-500 ml-2">{a.cliente_whatsapp}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {a.aprovado ? (
                      <button
                        onClick={() => setAprovado(a.id, false)}
                        className="px-2 py-1 text-xs rounded-md text-orange-700 border border-orange-300 hover:bg-orange-50"
                      >
                        Desaprovar
                      </button>
                    ) : (
                      <button
                        onClick={() => setAprovado(a.id, true)}
                        className="px-3 py-1 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 flex items-center gap-1"
                      >
                        <Check size={12} />
                        Aprovar
                      </button>
                    )}
                    <button
                      onClick={() => deletar(a.id)}
                      className="size-7 rounded-md hover:bg-red-50 flex items-center justify-center text-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {a.comentario && (
                  <p className="text-sm text-gray-700 italic mt-2 pl-3 border-l-2" style={{ borderColor: '#E5E7EB' }}>
                    "{a.comentario}"
                  </p>
                )}

                {a.resposta_admin && (
                  <div className="bg-green-50 rounded-xl p-3 mt-3 ml-3">
                    <div className="text-xs text-green-700 font-medium mb-1 flex items-center gap-1">
                      <MessageCircle size={12} />
                      Resposta da loja:
                    </div>
                    <div className="text-sm text-gray-700">{a.resposta_admin}</div>
                  </div>
                )}

                {respostaOpen === a.id ? (
                  <div className="mt-3 pl-3">
                    <textarea
                      value={respostaTexto}
                      onChange={(e) => setRespostaTexto(e.target.value)}
                      placeholder="Escreva uma resposta pública..."
                      rows={2}
                      className="form-input"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => salvarResposta(a.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1"
                      >
                        <Send size={12} />
                        Salvar resposta
                      </button>
                      <button
                        onClick={() => { setRespostaOpen(null); setRespostaTexto('') }}
                        className="px-3 py-1 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setRespostaOpen(a.id); setRespostaTexto(a.resposta_admin || '') }}
                    className="text-xs text-blue-600 hover:underline mt-2 ml-3"
                  >
                    {a.resposta_admin ? 'Editar resposta' : 'Responder'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
