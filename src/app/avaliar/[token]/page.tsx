'use client'

import { use, useEffect, useState } from 'react'
import { Star, MessageCircle, Package, CheckCircle, Loader2 } from 'lucide-react'

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [dados, setDados] = useState<any>()
  const [nota, setNota] = useState(0)
  const [comentario, setComentario] = useState('')
  const [msg, setMsg] = useState('Carregando...')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    fetch('/api/avaliacoes/public', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    }).then(async r => ({ ok: r.ok, b: await r.json() }))
      .then(x => {
        x.ok ? setDados(x.b) : setMsg(x.b.error)
        if (x.ok) setMsg('')
      }).catch(() => setMsg('Falha ao carregar convite.'))
  }, [token])

  async function enviar() {
    if (!nota) return setMsg('Escolha uma nota.')
    setEnviando(true)
    try {
      const r = await fetch('/api/avaliacoes/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nota, comentario })
      })
      const b = await r.json()
      if (r.ok) {
        setMsg('🎉 Obrigado pela sua avaliação!')
        setDados(undefined)
      } else {
        setMsg(b.error)
      }
    } catch {
      setMsg('Erro ao enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  const loja = dados?.pedido?.loja?.nome
  const codigoPedido = dados?.pedido?.codigo || dados?.pedido?.id?.slice(0, 8)
  const jaAvaliado = dados?.ja_avaliado
  const statusNaoEntregue = dados?.pedido?.status !== 'entregue'

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <section className="bg-white border border-green-100 rounded-3xl p-8 w-full max-w-md shadow-xl shadow-green-100/50">
        {/* Header com ícone */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Avalie seu pedido</h1>
          {loja && (
            <p className="text-gray-600">
              Conte como foi sua experiência com <span className="font-semibold text-green-700">{loja}</span>
            </p>
          )}
          {codigoPedido && (
            <p className="text-sm text-gray-400 mt-1">Pedido #{codigoPedido}</p>
          )}
        </div>

        {/* Conteúdo */}
        {jaAvaliado ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <p className="text-lg font-medium text-gray-700">Este pedido já foi avaliado!</p>
            <p className="text-sm text-gray-500 mt-2">Obrigado pelo seu feedback. 😊</p>
          </div>
        ) : statusNaoEntregue && dados ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-lg font-medium text-gray-700">Aguardando entrega</p>
            <p className="text-sm text-gray-500 mt-2">A avaliação será liberada após a entrega do seu pedido.</p>
          </div>
        ) : dados ? (
          <>
            {/* Estrelas */}
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setNota(n)}
                  className="transform transition-transform hover:scale-110 focus:outline-none"
                  aria-label={`${n} estrelas`}
                >
                  <Star
                    size={44}
                    fill={n <= nota ? '#eab308' : 'none'}
                    className={n <= nota ? 'text-yellow-500 drop-shadow-md' : 'text-gray-300'}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>

            {/* Label da nota */}
            <p className="text-center text-sm text-gray-500 mb-4 -mt-2">
              {nota === 0 && 'Toque nas estrelas para avaliar'}
              {nota === 1 && '😞 Muito ruim'}
              {nota === 2 && '😕 Ruim'}
              {nota === 3 && '😐 Regular'}
              {nota === 4 && '🙂 Bom'}
              {nota === 5 && '😍 Excelente!'}
            </p>

            {/* Comentário */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deixe um comentário (opcional)
              </label>
              <textarea
                className="form-input w-full resize-none"
                rows={3}
                maxLength={500}
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                placeholder="O que você achou do atendimento? Teve algum problema? Alguma sugestão?"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{comentario.length}/500</p>
            </div>

            {/* Botão */}
            <button
              onClick={enviar}
              disabled={enviando || nota === 0}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
                enviando || nota === 0
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200'
              }`}
            >
              {enviando ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Star className="w-5 h-5" />
                  Enviar avaliação
                </>
              )}
            </button>
          </>
        ) : null}

        {/* Mensagem de feedback */}
        {msg && (
          <div className={`mt-6 p-4 rounded-xl text-center text-sm ${
            msg.includes('Obrigado') || msg.includes('avaliado')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {msg}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by We Delivery
        </p>
      </section>
    </main>
  )
}
