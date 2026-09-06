'use client'

import { useState, useMemo } from 'react'
import { Star, Send, Check, ChevronLeft, ShoppingBag } from 'lucide-react'

type Tenant = {
  id: string
  nome: string
  slug: string
  logo_url: string | null
  cor_principal: string | null
}

// Helper para gerar uma cor "soft" (bg claro) a partir da cor principal do lojista
function softFromHex(hex: string, alpha = 0.12): string {
  const sanitized = hex.replace('#', '')
  if (sanitized.length !== 6) return `rgba(22,163,74,${alpha})`
  const r = parseInt(sanitized.slice(0, 2), 16)
  const g = parseInt(sanitized.slice(2, 4), 16)
  const b = parseInt(sanitized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Mensagens dinâmicas para cada nota (do HTML de referência)
const RATING_MESSAGES = ['', 'Muito ruim', 'Ruim', 'Regular', 'Muito bom', 'Excelente!']

export default function AvaliacaoForm({ tenant }: { tenant: Tenant }) {
  const [nota, setNota] = useState(0)
  const [hover, setHover] = useState(0)
  const [comentario, setComentario] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

  // Paleta dinâmica baseada na cor do lojista
  const accent = tenant.cor_principal || '#16A34A'
  const accentSoft = useMemo(() => softFromHex(accent, 0.14), [accent])
  const accentSoft2 = useMemo(() => softFromHex(accent, 0.06), [accent])

  // Variáveis CSS para adaptação dinâmica do tema
  const themeStyles = {
    '--review-accent': accent,
    '--review-soft': accentSoft,
    '--review-soft-2': accentSoft2,
  } as React.CSSProperties

  const submit = async () => {
    if (nota === 0) {
      setErro('Por favor, selecione uma nota de 1 a 5 estrelas.')
      return
    }

    setSubmitting(true)
    setErro('')

    try {
      const res = await fetch('/api/avaliar-publico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_slug: tenant.slug,
          nota,
          comentario: comentario.trim() || null,
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

  return (
    <div
      className="min-h-screen w-full grid place-items-center p-4 sm:p-6"
      style={{
        ...themeStyles,
        background: 'var(--review-page, #F5F6F8)',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        color: 'var(--review-text, #181C25)',
      }}
    >
      <style jsx>{`
        @media (prefers-color-scheme: dark) {
          .review-phone {
            --review-page: #111318;
            --review-surface: #1C1F25;
            --review-text: #F5F7FA;
            --review-muted: #ADB4C0;
            --review-border: #353A44;
            --review-soft: var(--review-soft-2, #3A261F);
          }
        }
        .review-phone {
          --review-page: #F5F6F8;
          --review-surface: #FFFFFF;
          --review-text: #181C25;
          --review-muted: #717887;
          --review-border: #E3E6EB;
        }
      `}</style>

      <section
        className="review-phone w-full max-w-[390px] overflow-hidden rounded-[28px] border shadow-2xl"
        style={{
          background: 'var(--review-surface)',
          borderColor: 'var(--review-border)',
        }}
      >
        {/* Topbar com botão voltar e título */}
        <header
          className="flex items-center gap-3 px-[18px] py-[17px]"
          style={{ borderBottom: '1px solid var(--review-border)' }}
        >
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => window.history.back()}
            className="grid place-items-center w-10 h-10 rounded-full border-0 cursor-pointer transition active:scale-95"
            style={{
              background: 'var(--review-page)',
              color: 'var(--review-text)',
            }}
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
          <h2 className="m-0 text-[17px] font-medium" style={{ color: 'var(--review-text)' }}>
            Avaliar experiência
          </h2>
        </header>

        {sucesso ? (
          /* Estado de sucesso */
          <div className="px-6 py-12 sm:py-14 text-center">
            <div
              className="w-[70px] h-[70px] mx-auto mb-4 grid place-items-center rounded-full"
              style={{ background: 'var(--review-soft)', color: 'var(--review-accent)' }}
            >
              <Check size={34} strokeWidth={2} />
            </div>
            <h3 className="m-0 text-[22px] font-medium tracking-tight" style={{ color: 'var(--review-text)' }}>
              Obrigado pela avaliação!
            </h3>
            <p className="mt-2 text-sm leading-[1.45]" style={{ color: 'var(--review-muted)' }}>
              Sua opinião foi enviada e ajudará a melhorar as próximas experiências.
            </p>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="mt-6 px-5 py-2.5 rounded-xl text-sm font-medium transition active:scale-95"
              style={{
                background: 'var(--review-surface)',
                color: 'var(--review-accent)',
                border: '1px solid var(--review-accent)',
              }}
            >
              Voltar
            </button>
          </div>
        ) : (
          <>
            {/* Card principal com formulário */}
            <main className="p-[18px]">
              <section
                className="rounded-[22px] p-6 sm:p-7 text-center"
                style={{
                  background: 'var(--review-surface)',
                  border: '1px solid var(--review-border)',
                  boxShadow: '0 5px 18px rgba(0,0,0,0.06)',
                }}
              >
                {/* Logo do lojista */}
                <div
                  className="w-[60px] h-[60px] mx-auto mb-[15px] grid place-items-center rounded-[18px]"
                  style={{
                    background: 'var(--review-soft)',
                    color: 'var(--review-accent)',
                  }}
                >
                  {tenant.logo_url ? (
                    <img
                      src={tenant.logo_url}
                      alt={tenant.nome}
                      className="w-full h-full object-cover rounded-[14px]"
                    />
                  ) : (
                    <ShoppingBag size={28} strokeWidth={2} />
                  )}
                </div>

                <h3 className="m-0 text-[22px] font-medium tracking-[-0.02em]" style={{ color: 'var(--review-text)' }}>
                  Como foi seu pedido?
                </h3>
                <p className="mt-2 mb-0 text-sm leading-[1.45]" style={{ color: 'var(--review-muted)' }}>
                  Sua avaliação ajuda o estabelecimento a melhorar cada vez mais.
                </p>

                {/* Estrelas interativas */}
                <div
                  role="radiogroup"
                  aria-label="Nota de 1 a 5 estrelas"
                  className="flex justify-center gap-[7px] mt-6"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNota(n)}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      role="radio"
                      aria-checked={nota === n}
                      aria-label={`${n} ${n > 1 ? 'estrelas' : 'estrela'}`}
                      className="grid place-items-center w-12 h-12 p-0 border-0 bg-transparent cursor-pointer transition-transform duration-150"
                      style={{
                        color: (hover || nota) >= n ? '#F5AE20' : 'var(--review-muted)',
                        transform: hover === n ? 'translateY(-2px)' : 'translateY(0)',
                      }}
                    >
                      <Star
                        size={38}
                        fill={(hover || nota) >= n ? 'currentColor' : 'none'}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                </div>
                <p
                  className="min-h-[21px] mt-[9px] mb-0 text-sm font-medium"
                  aria-live="polite"
                  style={{ color: 'var(--review-accent)' }}
                >
                  {nota === 0 ? 'Selecione uma nota' : RATING_MESSAGES[nota]}
                </p>

                {/* Comentário */}
                <div className="mt-4 text-left">
                  <div className="flex justify-between items-center gap-2.5 mb-2">
                    <label
                      htmlFor="reviewComment"
                      className="text-sm font-medium"
                      style={{ color: 'var(--review-text)' }}
                    >
                      Conte como foi{' '}
                      <span className="font-normal text-xs" style={{ color: 'var(--review-muted)' }}>
                        (opcional)
                      </span>
                    </label>
                    <span className="text-[11px]" style={{ color: 'var(--review-muted)' }}>
                      <span>{comentario.length}</span>/300
                    </span>
                  </div>
                  <textarea
                    id="reviewComment"
                    maxLength={300}
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder="Escreva aqui sua opinião sobre o pedido..."
                    rows={4}
                    className="w-full min-h-[112px] px-[14px] py-[13px] rounded-[14px] outline-none resize-y text-base leading-[1.4]"
                    style={{
                      border: '1px solid var(--review-border)',
                      background: 'var(--review-surface)',
                      color: 'var(--review-text)',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--review-accent)'
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${softFromHex(accent, 0.16)}`
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--review-border)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>

                {/* Erro */}
                {erro && (
                  <p
                    className="min-h-[17px] mt-2 mb-0 text-xs text-center"
                    role="alert"
                    style={{ color: '#C9343E' }}
                  >
                    {erro}
                  </p>
                )}

                {/* Botão submit */}
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || nota === 0}
                  className="w-full min-h-[50px] mt-4 flex items-center justify-center gap-2 border-0 rounded-[14px] text-white text-[15px] font-medium cursor-pointer transition disabled:cursor-not-allowed"
                  style={{
                    background: 'var(--review-accent)',
                    opacity: submitting || nota === 0 ? 0.45 : 1,
                  }}
                >
                  <Send size={18} />
                  {submitting ? 'Enviando…' : 'Enviar avaliação'}
                </button>
              </section>

              <p
                className="text-[11px] leading-[1.4] text-center mt-3 px-2"
                style={{ color: 'var(--review-muted)' }}
              >
                Sua opinião será compartilhada com o estabelecimento.
              </p>
            </main>
          </>
        )}
      </section>
    </div>
  )
}
