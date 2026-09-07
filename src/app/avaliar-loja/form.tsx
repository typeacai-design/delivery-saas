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

// Gera estilos CSS dinâmicos com base na cor do lojista
function buildReviewStyles(accent: string): React.CSSProperties {
  // Soft backgrounds derivados da cor
  const hex = accent.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16) || 239
  const g = parseInt(hex.slice(2, 4), 16) || 91
  const b = parseInt(hex.slice(4, 6), 16) || 37
  const soft = `rgba(${r}, ${g}, ${b}, 0.12)`

  return {
    ['--review-accent' as any]: accent,
    ['--review-soft' as any]: soft,
  }
}

export default function AvaliacaoForm({ tenant, mode = 'loja', token, pedidoInfo }: AvaliacaoFormProps) {
  const [nota, setNota] = useState(0)
  const [hover, setHover] = useState(0)
  const [comentario, setComentario] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState<any>(null)
  const [carregando, setCarregando] = useState(mode === 'pedido')

  const accent = tenant.cor_principal || '#ef5b25'
  const themeStyles = useMemo(() => buildReviewStyles(accent), [accent])

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
    <div
      id="customer-review-ui"
      aria-label="Tela de avaliação da experiência do cliente"
      style={{
        ...themeStyles,
        color: 'var(--review-text)',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        display: 'grid',
        placeItems: 'center',
        padding: '18px 8px',
        background: 'transparent',
      }}
    >
      <style jsx>{`
        #customer-review-ui * { box-sizing: border-box; }
        #customer-review-ui button,
        #customer-review-ui textarea { font: inherit; }

        @media (prefers-color-scheme: light) {
          #customer-review-ui {
            --review-page: #f5f6f8;
            --review-surface: #ffffff;
            --review-text: #181c25;
            --review-muted: #717887;
            --review-border: #e3e6eb;
            --review-star-off: #d7dbe2;
          }
        }
        @media (prefers-color-scheme: dark) {
          #customer-review-ui {
            --review-page: #111318;
            --review-surface: #1c1f25;
            --review-text: #f5f7fa;
            --review-muted: #adb4c0;
            --review-border: #353a44;
            --review-star-off: #505661;
          }
        }

        .review-phone {
          width: min(100%, 390px);
          overflow: hidden;
          background: var(--review-page);
          border: 1px solid var(--review-border);
          border-radius: 28px;
          box-shadow: 0 18px 50px rgba(22,29,43,0.12);
        }
        .review-topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 17px 18px;
          background: var(--review-surface);
          border-bottom: 1px solid var(--review-border);
        }
        .review-back {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: var(--review-page);
          color: var(--review-text);
          cursor: pointer;
        }
        .review-topbar h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 500;
        }
        .review-body {
          padding: 18px;
        }
        .review-main {
          padding: 24px 20px;
          text-align: center;
          background: var(--review-surface);
          border-radius: 22px;
          box-shadow: 0 5px 18px rgba(22,29,43,0.06);
        }
        .review-brand {
          width: 60px;
          height: 60px;
          margin: 0 auto 15px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          background: var(--review-soft);
          color: var(--review-accent);
          overflow: hidden;
        }
        .review-brand img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .review-brand svg {
          width: 28px;
          height: 28px;
        }
        .review-main h3 {
          margin: 0;
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.02em;
        }
        .review-intro {
          margin: 8px 0 0;
          color: var(--review-muted);
          font-size: 14px;
          line-height: 1.45;
        }
        .review-order {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          color: var(--review-muted);
          font-size: 12px;
        }
        .review-order svg {
          width: 14px;
          height: 14px;
        }
        .review-stars {
          display: flex;
          justify-content: center;
          gap: 7px;
          margin-top: 24px;
        }
        .review-star {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--review-star-off);
          cursor: pointer;
          transition: color 0.16s ease, transform 0.16s ease;
        }
        .review-star:hover {
          transform: translateY(-2px);
        }
        .review-star.selected {
          color: #f5ae20;
        }
        .review-star svg {
          width: 38px;
          height: 38px;
          fill: currentColor;
        }
        .review-rating-text {
          min-height: 21px;
          margin: 9px 0 0;
          color: var(--review-accent);
          font-size: 14px;
          font-weight: 500;
        }
        .review-field {
          margin-top: 16px;
          text-align: left;
        }
        .review-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }
        .review-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--review-text);
        }
        .review-optional {
          color: var(--review-muted);
          font-size: 12px;
          font-weight: 400;
        }
        .review-counter {
          color: var(--review-muted);
          font-size: 11px;
        }
        #customer-review-ui textarea {
          width: 100%;
          min-height: 112px;
          resize: vertical;
          padding: 13px 14px;
          border: 1px solid var(--review-border);
          border-radius: 14px;
          outline: none;
          background: var(--review-surface);
          color: var(--review-text);
          font-size: 16px;
          line-height: 1.4;
        }
        #customer-review-ui textarea::placeholder {
          color: var(--review-muted);
        }
        #customer-review-ui textarea:focus {
          border-color: var(--review-accent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--review-accent) 16%, transparent);
        }
        .review-submit {
          width: 100%;
          min-height: 50px;
          margin-top: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          border-radius: 14px;
          background: var(--review-accent);
          color: white;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
        }
        .review-submit:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .review-submit svg {
          width: 18px;
          height: 18px;
        }
        .review-privacy {
          margin: 12px 8px 0;
          color: var(--review-muted);
          text-align: center;
          font-size: 11px;
          line-height: 1.4;
        }
        .review-success {
          display: none;
          padding: 52px 26px 58px;
          text-align: center;
          background: var(--review-surface);
        }
        .review-success.visible {
          display: block;
        }
        .review-success-icon {
          width: 70px;
          height: 70px;
          margin: 0 auto 16px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: var(--review-soft);
          color: var(--review-accent);
        }
        .review-success-icon svg {
          width: 34px;
          height: 34px;
        }
        .review-success h3 {
          margin: 0;
          font-size: 22px;
          font-weight: 500;
        }
        .review-success p {
          margin: 8px 0 0;
          color: var(--review-muted);
          font-size: 14px;
          line-height: 1.45;
        }
        .review-success-back {
          margin-top: 20px;
          padding: 10px 20px;
          border: 1px solid var(--review-accent);
          border-radius: 12px;
          color: var(--review-accent);
          background: var(--review-surface);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }
        .review-error {
          min-height: 17px;
          margin: 8px 0 0;
          color: #c9343e;
          font-size: 12px;
          text-align: center;
        }
        @media (max-width: 350px) {
          .review-body { padding: 13px; }
          .review-main { padding: 21px 14px; }
          .review-stars { gap: 2px; }
          .review-star { width: 45px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .review-star { transition: none; }
        }
        @media (prefers-color-scheme: dark) {
          .review-error { color: #ff8f98; }
          .review-phone { box-shadow: 0 18px 50px rgba(0,0,0,0.35); }
          .review-main { box-shadow: 0 5px 18px rgba(0,0,0,0.18); }
        }
      `}</style>

      <section className="review-phone">
        <div className="review-form-view" style={{ display: sucesso ? 'none' : 'block' }}>
          {/* Topbar */}
          <header className="review-topbar">
            <button
              className="review-back"
              type="button"
              aria-label="Voltar"
              onClick={() => window.history.back()}
            >
              <ChevronLeft size={20} strokeWidth={2} />
            </button>
            <h2>{mode === 'pedido' ? 'Avalie seu pedido' : 'Avaliar experiência'}</h2>
          </header>

          <main className="review-body">
            {carregando ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-current rounded-full animate-spin" style={{ color: 'var(--review-accent)' }} />
                <p className="mt-3 text-sm" style={{ color: 'var(--review-muted)' }}>Carregando...</p>
              </div>
            ) : jaAvaliado ? (
              <div style={{ padding: '52px 26px 58px', textAlign: 'center' }}>
                <div className="review-success-icon">
                  <Check size={34} strokeWidth={2} />
                </div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>Este pedido já foi avaliado</h3>
                <p style={{ margin: '8px 0 0', color: 'var(--review-muted)', fontSize: 14, lineHeight: 1.45 }}>
                  Obrigado pelo seu feedback!
                </p>
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="review-success-back"
                >
                  Voltar
                </button>
              </div>
            ) : statusNaoEntregue ? (
              <div style={{ padding: '52px 26px 58px', textAlign: 'center' }}>
                <div className="review-success-icon" style={{ fontSize: 32 }}>
                  📦
                </div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>Aguardando entrega</h3>
                <p style={{ margin: '8px 0 0', color: 'var(--review-muted)', fontSize: 14, lineHeight: 1.45 }}>
                  A avaliação será liberada após a entrega do seu pedido.
                </p>
              </div>
            ) : (
              <>
                <section className="review-main">
                  {/* Logo do lojista */}
                  <div className="review-brand">
                    {tenant.logo_url ? (
                      <img src={tenant.logo_url} alt={tenant.nome} />
                    ) : (
                      <ShoppingBag size={28} strokeWidth={2} />
                    )}
                  </div>

                  <h3>{mode === 'pedido' ? 'Como foi seu pedido?' : 'Como foi sua experiência?'}</h3>
                  <p className="review-intro">Sua avaliação ajuda o estabelecimento a melhorar cada vez mais.</p>

                  {codigoPedido && (
                    <span className="review-order">
                      <ReceiptText size={14} strokeWidth={1.6} />
                      Pedido #{codigoPedido}
                    </span>
                  )}

                  {/* Estrelas */}
                  <div className="review-stars" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = (hover || nota) >= n
                      return (
                        <button
                          key={n}
                          type="button"
                          data-rating={n}
                          role="radio"
                          aria-checked={nota === n}
                          aria-label={`${n} ${n > 1 ? 'estrelas' : 'estrela'}`}
                          className={`review-star${active ? ' selected' : ''}`}
                          onClick={() => setNota(n)}
                          onMouseEnter={() => setHover(n)}
                          onMouseLeave={() => setHover(0)}
                        >
                          <Star strokeWidth={1.5} fill={active ? 'currentColor' : 'none'} />
                        </button>
                      )
                    })}
                  </div>
                  <p className="review-rating-text" aria-live="polite">
                    {nota === 0 ? 'Selecione uma nota' : RATING_MESSAGES[nota]}
                  </p>

                  {/* Comentário */}
                  <div className="review-field">
                    <div className="review-label-row">
                      <label className="review-label" htmlFor="reviewComment">
                        Conte como foi <span className="review-optional">(opcional)</span>
                      </label>
                      <span className="review-counter">
                        <span>{comentario.length}</span>/300
                      </span>
                    </div>
                    <textarea
                      id="reviewComment"
                      maxLength={300}
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      placeholder="Escreva aqui sua opinião sobre o pedido..."
                    />
                  </div>

                  {/* Erro */}
                  <p className="review-error" role="alert">{erro}</p>

                  {/* Botão submit */}
                  <button
                    type="button"
                    className="review-submit"
                    onClick={submit}
                    disabled={submitting || nota === 0}
                  >
                    <Send size={18} strokeWidth={1.6} />
                    {submitting ? 'Enviando…' : 'Enviar avaliação'}
                  </button>
                </section>

                <p className="review-privacy">Sua opinião será compartilhada com o estabelecimento.</p>
              </>
            )}
          </main>
        </div>

        {/* Estado de sucesso */}
        <section className={`review-success${sucesso ? ' visible' : ''}`} aria-live="polite">
          <div className="review-success-icon">
            <CircleCheckBig size={34} strokeWidth={2} />
          </div>
          <h3>Obrigado pela avaliação!</h3>
          <p>Sua opinião foi enviada e ajudará a melhorar as próximas experiências.</p>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="review-success-back"
          >
            Voltar
          </button>
        </section>
      </section>
    </div>
  )
}
