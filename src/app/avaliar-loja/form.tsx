'use client'

import { useState } from 'react'
import { Star, Check, Send, Loader2 } from 'lucide-react'

type Tenant = {
  id: string
  nome: string
  slug: string
  logo_url: string | null
  cor_principal: string | null
}

export default function AvaliacaoForm({ tenant }: { tenant: Tenant }) {
  const [nota, setNota] = useState(0)
  const [hover, setHover] = useState(0)
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [comentario, setComentario] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

  const accent = tenant.cor_principal || '#16A34A'

  const submit = async () => {
    if (nota === 0) {
      setErro('Por favor, selecione uma nota de 1 a 5 estrelas.')
      return
    }

    setSubmitting(true)
    setErro('')

    try {
      const res = await fetch('/api/avaliacoes/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_slug: tenant.slug,
          nota,
          comentario: comentario.trim() || null,
          cliente_nome: nome.trim() || null,
          cliente_whatsapp: whatsapp.replace(/\D/g, '') || null,
        }),
      })

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

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F8FAFC' }}>
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div
            className="size-20 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: `${accent}22` }}
          >
            <Check size={36} style={{ color: accent }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#172033' }}>
            Avaliação enviada!
          </h1>
          <p className="text-sm mb-1" style={{ color: '#697386' }}>
            Obrigado por avaliar <strong>{tenant.nome}</strong>.
          </p>
          <p className="text-sm" style={{ color: '#697386' }}>
            Sua opinião ajuda o estabelecimento a melhorar.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F8FAFC' }}>
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header com cor do lojista */}
        <div className="px-6 py-8 text-center" style={{ background: accent }}>
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={tenant.nome}
              className="size-20 rounded-full mx-auto mb-3 object-cover bg-white p-1"
            />
          ) : (
            <div
              className="size-20 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl font-bold text-white"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              {tenant.nome[0]?.toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-bold text-white">{tenant.nome}</h1>
          <p className="text-sm text-white/90 mt-1">Avalie sua experiência</p>
        </div>

        {/* Estrelas */}
        <div className="px-6 py-6">
          <div className="flex justify-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNota(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                className="transition-transform hover:scale-110"
                aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
              >
                <Star
                  size={48}
                  className="transition-colors"
                  fill={(hover || nota) >= n ? '#FBBF24' : 'none'}
                  stroke={(hover || nota) >= n ? '#FBBF24' : '#D1D5DB'}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-sm" style={{ color: '#697386' }}>
            {nota === 0 && 'Selecione uma nota'}
            {nota === 1 && 'Péssimo'}
            {nota === 2 && 'Ruim'}
            {nota === 3 && 'Regular'}
            {nota === 4 && 'Ótimo'}
            {nota === 5 && 'Excelente'}
          </p>
        </div>

        {/* Comentário + dados do cliente */}
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#172033' }}>
              Comentário (opcional)
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={4}
              placeholder="Conte como foi sua experiência..."
              maxLength={500}
              className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2"
              style={{ borderColor: '#E4E8EE' }}
            />
            <p className="text-xs mt-1 text-right" style={{ color: '#9CA3AF' }}>
              {comentario.length}/500
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#172033' }}>
                Seu nome (opcional)
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Como podemos te chamar?"
                className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: '#E4E8EE' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#172033' }}>
                WhatsApp (opcional)
              </label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: '#E4E8EE' }}
              />
            </div>
          </div>

          {erro && (
            <div className="p-3 rounded-xl text-sm" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
              {erro}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={submitting || nota === 0}
            className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: accent }}
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Enviando…
              </>
            ) : (
              <>
                <Send size={18} /> Enviar avaliação
              </>
            )}
          </button>

          <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
            Sua avaliação será analisada pelo estabelecimento antes de ser exibida publicamente.
          </p>
        </div>
      </div>
    </div>
  )
}
