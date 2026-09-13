'use client'

import { useState, useMemo, useEffect } from 'react'
import { Star, Send, Check, ChevronLeft, ShoppingBag, ReceiptText, CircleCheckBig } from 'lucide-react'

type Tenant = {
  id: string
  nome: string
  slug: string
  logo_url: string | null
  cor_principal: string | null
}

type AvaliacaoFormProps = {
  tenant: Tenant
  mode?: 'loja' | 'pedido'
  token?: string
  pedidoInfo?: { codigo?: string; id?: string }
}

// Mensagens dinâmicas para cada nota
const RATING_MESSAGES = ['', 'Muito ruim', 'Ruim', 'Regular', 'Muito bom', 'Excelente!']

export default function AvaliacaoForm({ tenant, mode = 'loja', token, pedidoInfo }: AvaliacaoFormProps) {
  const [nota, setNota] = useState(0)
  const [hover, setHover] = useState(0)
  const [comentario, setComentario] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState<any>(null)
  const [carregando, setCarregando] = useState(mode === 'pedido')

  const accent = tenant.cor_principal || '#16A34A'

  // Carregar dados do convite (modo pedido)
  useEffect(() => {
    if (mode !== 'pedido' || !token) return
    fetch('/api/avaliacoes/public', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => ({ ok: r.ok, b: await r.json() }))
      .then((x) => {
        setCarregando(false)
        if (!x.ok) {
          setErro(x.b.error || 'Convite inválido')
          return
        }
        setDados(x.b)
      })
      .catch(() => {
        setCarregando(false)
        setErro('Falha ao carregar convite.')
      })
  }, [mode, token])

  const submit = async () => {
    if (nota === 0) {
      setErro('Por favor, selecione uma nota de 1 a 5 estrelas.')
      return
    }

    setSubmitting(true)
    setErro('')

    try {
      let res: Response
      if (mode === 'pedido' && token) {
        res = await fetch('/api/avaliacoes/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            nota,
            comentario: comentario.trim(),
          }),
        })
      } else {
        res = await fetch('/api/avaliar-publico', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_slug: tenant.slug,
            nota,
            comentario: comentario.trim() || null,
          }),
        })
      }

      const body = await res.json()

      if (!res.ok) {
        throw new Error(body.error || 'Erro ao enviar avaliação')
      }

      setSucesso(true)
    } catch (err: any) {
      setErro(err.message || 'Não foi possível enviar a avaliação')
    } finally {
      setSubmitting(false)
    }
  }

  const jaAvaliado = mode === 'pedido' && dados?.ja_avaliado
  const statusNaoEntregue = mode === 'pedido' && dados?.pedido?.status !== 'entregue'
  const codigoPedido = pedidoInfo?.codigo || dados?.pedido?.codigo || dados?.pedido?.id?.slice(0, 8)

  return (
    <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">

        {/* Header com botão voltar e logo do lojista */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => window.history.back()}
            className="w-9 h-9 rounded-full border border-gray-200 grid place-items-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={18} className="text-gray-700" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 m-0">
            {mode === 'pedido' ? 'Avalie seu pedido' : 'Avaliar experiência'}
          </h2>
        </div>

        <div className="p-5">
          {carregando ? (
            <div className="text-center py-10">
              <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-green-600 rounded-full animate-spin" />
              <p className="mt-3 text-sm text-gray-500">Carregando...</p>
            </div>
          ) : jaAvaliado ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full grid place-items-center">
                <Check size={32} className="text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Este pedido já foi avaliado</h3>
              <p className="text-sm text-gray-500 mt-2">Obrigado pelo seu feedback!</p>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="mt-5 px-5 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Voltar
              </button>
            </div>
          ) : statusNaoEntregue ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full grid place-items-center text-3xl">
                📦
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Aguardando entrega</h3>
              <p className="text-sm text-gray-500 mt-2">
                A avaliação será liberada após a entrega do seu pedido.
              </p>
            </div>
          ) : sucesso ? (
            /* Estado de sucesso */
            <div className="text-center py-10">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-full grid place-items-center"
                style={{ background: 'var(--review-soft, #DCFCE7)', color: accent }}
              >
                <CircleCheckBig size={32} strokeWidth={2} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Obrigado pela avaliação!</h3>
              <p className="text-sm text-gray-500 mt-2">
                Sua opinião foi enviada e ajudará a melhorar as próximas experiências.
              </p>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="mt-5 px-5 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Voltar
              </button>
            </div>
          ) : (
            <>
              {/* Card principal */}
              <div className="rounded-xl p-5 text-center border border-gray-200">

                {/* Logo do lojista */}
                <div
                  className="w-14 h-14 mx-auto mb-3 rounded-xl grid place-items-center overflow-hidden"
                  style={{
                    background: '#F3F4F6',
                    color: accent,
                    border: `1px solid ${accent}33`,
                  }}
                >
                  {tenant.logo_url ? (
                    <img src={tenant.logo_url} alt={tenant.nome} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag size={26} strokeWidth={2} />
                  )}
                </div>

                <h3 className="text-xl font-semibold text-gray-900">
                  {mode === 'pedido' ? 'Como foi seu pedido?' : 'Como foi sua experiência?'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Sua avaliação ajuda o estabelecimento a melhorar cada vez mais.
                </p>

                {codigoPedido && (
                  <p className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1">
                    <ReceiptText size={12} />
                    Pedido #{codigoPedido}
                  </p>
                )}

                {/* Estrelas */}
                <div className="flex justify-center gap-2 mt-5" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active = (hover || nota) >= n
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNota(n)}
                        onMouseEnter={() => setHover(n)}
                        onMouseLeave={() => setHover(0)}
                        role="radio"
                        aria-checked={nota === n}
                        aria-label={`${n} ${n > 1 ? 'estrelas' : 'estrela'}`}
                        className="w-11 h-11 grid place-items-center bg-transparent border-0 cursor-pointer transition-transform duration-150 hover:-translate-y-0.5"
                        style={{ color: active ? '#F5AE20' : '#D1D5DB' }}
                      >
                        <Star
                          size={36}
                          strokeWidth={1.5}
                          fill={active ? 'currentColor' : 'none'}
                        />
                      </button>
                    )
                  })}
                </div>
                <p className="min-h-[20px] mt-2 mb-0 text-sm font-medium" style={{ color: accent }}>
                  {nota === 0 ? 'Selecione uma nota' : RATING_MESSAGES[nota]}
                </p>

                {/* Comentário */}
                <div className="mt-5 text-left">
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="reviewComment" className="text-sm font-medium text-gray-700">
                      Conte como foi <span className="text-gray-400 font-normal text-xs">(opcional)</span>
                    </label>
                    <span className="text-xs text-gray-400">
                      {comentario.length}/300
                    </span>
                  </div>
                  <textarea
                    id="reviewComment"
                    maxLength={300}
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder="Escreva aqui sua opinião sobre o pedido..."
                    rows={4}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none resize-y text-sm bg-white text-gray-900 placeholder-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                {/* Erro */}
                {erro && (
                  <p className="min-h-[17px] mt-2 mb-0 text-xs text-red-600 text-center" role="alert">
                    {erro}
                  </p>
                )}

                {/* Botão submit */}
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || nota === 0}
                  className="w-full py-3.5 mt-3 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: accent }}
                >
                  <Send size={16} />
                  {submitting ? 'Enviando…' : 'Enviar avaliação'}
                </button>
              </div>

              <p className="text-xs text-gray-400 text-center mt-3">
                Sua opinião será compartilhada com o estabelecimento.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
