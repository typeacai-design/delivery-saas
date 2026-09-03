'use client'

import { useState } from 'react'
import { X, Plus, Minus, ShoppingCart, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export interface CartItem {
  id: string
  produto_id: string
  nome: string
  quantidade: number
  valor_unitario: number
  variante_id?: string
  variante_nome?: string
  variante_preco?: number
  complementos: CartComplemento[]
  tempo_preparo_min?: number
  pontos?: number
}

export interface CartComplemento {
  id: string
  nome: string
  quantidade: number
  valor: number
}

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  itens: CartItem[]
  onUpdateQuantity: (itemId: string, quantidade: number) => void
  onRemoveItem: (itemId: string) => void
  tenantNome: string
  tenantTelefone: string
  onLimparCarrinho: () => void
}

export function CartDrawer({
  isOpen,
  onClose,
  itens,
  onUpdateQuantity,
  onRemoveItem,
  tenantNome,
  tenantTelefone,
  onLimparCarrinho
}: CartDrawerProps) {
  const total = itens.reduce((acc, item) => {
    const complementosTotal = item.complementos.reduce((sum, c) => sum + (c.valor * c.quantidade), 0)
    const variantePreco = item.variante_preco || 0
    return acc + ((item.valor_unitario + variantePreco + complementosTotal) * item.quantidade)
  }, 0)

  const totalItens = itens.reduce((acc, item) => acc + item.quantidade, 0)

  // Calcula tempo de preparo: usa o maior entre os produtos do carrinho
  const tempoPreparo = itens.reduce((max, item) => {
    const t = (item as any).tempo_preparo_min || 30
    return Math.max(max, t)
  }, 0)

  function formatFaixaTempo(min: number): string {
    if (min <= 0) return ''
    const minFaixa = Math.max(5, Math.round(min * 0.9))
    const maxFaixa = Math.round(min * 1.2)
    if (minFaixa === maxFaixa) return `${minFaixa} min`
    return `${minFaixa}-${maxFaixa} min`
  }

  function gerarTextoWhatsApp() {
    let texto = `🛒 *PEDIDO - ${tenantNome}*\n\n`

    if (itens.length === 0) return ''

    itens.forEach((item, index) => {
      texto += `*${index + 1}. ${item.nome}*\n`
      if (item.variante_nome) {
        texto += `   📦 Variação: ${item.variante_nome}\n`
      }
      if (item.complementos.length > 0) {
        texto += `   ➕ Adicionais:\n`
        item.complementos.forEach(c => {
          texto += `      - ${c.quantidade}x ${c.nome} (${formatCurrency(c.valor)})\n`
        })
      }
      texto += `   Qtd: ${item.quantidade}x\n`
      texto += `   Subtotal: ${formatCurrency((item.valor_unitario + (item.variante_preco || 0) + item.complementos.reduce((s, c) => s + c.valor * c.quantidade, 0)) * item.quantidade)}\n\n`
    })

    texto += `─────────────────────\n`
    texto += `*TOTAL: ${formatCurrency(total)}*\n`
    if (tempoPreparo > 0) {
      texto += `⏱️ *Tempo de preparo:* ${formatFaixaTempo(tempoPreparo)}\n`
    }
    texto += `\n📍 *Endereço de entrega:*\n[Informe seu endereço completo]`
    texto += `\n\n💰 *Forma de pagamento:*\n[Informe a forma de pagamento]`

    return texto
  }

  function enviarWhatsApp() {
    const texto = gerarTextoWhatsApp()
    if (!texto) return

    const telefoneLimpo = tenantTelefone?.replace(/\D/g, '') || '0000000000'
    const url = `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank')

    // Limpar carrinho após enviar
    onLimparCarrinho()
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-green-600" />
            <h2 className="font-bold text-lg">Seu Pedido</h2>
            {totalItens > 0 && (
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {totalItens}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {itens.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Carrinho vazio</p>
              <p className="text-sm mt-1">Adicione itens do cardápio</p>
            </div>
          ) : (
            <div className="space-y-4">
              {itens.map((item) => {
                const subTotal = (
                  (item.valor_unitario + (item.variante_preco || 0) +
                    item.complementos.reduce((s, c) => s + c.valor * c.quantidade, 0)) *
                  item.quantidade
                )

                return (
                  <div key={item.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.nome}</h3>
                        {item.variante_nome && (
                          <p className="text-sm text-gray-500">{item.variante_nome}</p>
                        )}
                        {item.complementos.length > 0 && (
                          <div className="mt-1">
                            {item.complementos.map((c) => (
                              <p key={c.id} className="text-xs text-gray-500">
                                + {c.quantidade}x {c.nome}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="font-bold text-green-600">{formatCurrency(subTotal)}</p>
                    </div>

                    {/* Controles de quantidade */}
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <button
                        onClick={() => {
                          if (item.quantidade <= 1) {
                            onRemoveItem(item.id)
                          } else {
                            onUpdateQuantity(item.id, item.quantidade - 1)
                          }
                        }}
                        className="p-1.5 bg-white rounded-full border hover:bg-gray-100 transition-colors"
                      >
                        {item.quantidade <= 1 ? (
                          <X className="w-4 h-4 text-red-500" />
                        ) : (
                          <Minus className="w-4 h-4" />
                        )}
                      </button>
                      <span className="font-semibold w-8 text-center">{item.quantidade}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantidade + 1)}
                        className="p-1.5 bg-white rounded-full border hover:bg-gray-100 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {itens.length > 0 && (
          <div className="border-t p-4 space-y-3 bg-white">
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">Total</span>
              <span className="font-bold text-2xl text-green-600">{formatCurrency(total)}</span>
            </div>

            {tempoPreparo > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-800">
                  Pronto em <strong>{formatFaixaTempo(tempoPreparo)}</strong>
                </span>
              </div>
            )}

            <button
              onClick={enviarWhatsApp}
              className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 text-lg"
              style={{
                background: '#22C55E',
                boxShadow: '0 0 0 4px rgba(34,197,94,.25), 0 8px 24px -8px rgba(22,163,74,.5)',
              }}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar Pedido
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </>
  )
}

// Modal de seleção de produto (variantes e complementos)
interface ProdutoModalProps {
  isOpen: boolean
  onClose: () => void
  produto: any
  variantes: any[]
  complementos: any[]
  onAddToCart: (item: Omit<CartItem, 'id'>) => void
  paletaCor: string
}

export function ProdutoModal({
  isOpen,
  onClose,
  produto,
  variantes,
  complementos,
  onAddToCart,
  paletaCor
}: ProdutoModalProps) {
  const [quantidade, setQuantidade] = useState(1)
  const [varianteSelecionada, setVarianteSelecionada] = useState<string | null>(
    variantes.length === 1 ? variantes[0].id : null
  )
  const [complementosSelecionados, setComplementosSelecionados] = useState<{[key: string]: number}>({})

  if (!isOpen || !produto) return null

  const variante = variantes.find(v => v.id === varianteSelecionada)
  const precoBase = produto.preco + (variante?.preco_adicional || 0)
  const precoComplementos = Object.entries(complementosSelecionados).reduce((acc, [id, qtd]) => {
    const comp = complementos.find(c => c.id === id)
    return acc + (comp?.preco || 0) * (qtd as number)
  }, 0)
  const total = (precoBase + precoComplementos) * quantidade

  function toggleComplemento(complementoId: string) {
    setComplementosSelecionados(prev => {
      if (prev[complementoId]) {
        const newPrev = { ...prev }
        delete newPrev[complementoId]
        return newPrev
      } else {
        return { ...prev, [complementoId]: 1 }
      }
    })
  }

  function adicionar() {
    const complementoItems = Object.entries(complementosSelecionados)
      .filter(([_, qtd]) => (qtd as number) > 0)
      .map(([id, qtd]) => {
        const comp = complementos.find(c => c.id === id)!
        return {
          id,
          nome: comp.nome,
          quantidade: qtd as number,
          valor: comp.preco
        }
      })

    onAddToCart({
      produto_id: produto.id,
      nome: produto.nome,
      quantidade,
      valor_unitario: produto.preco,
      variante_id: variante?.id,
      variante_nome: variante?.nome,
      variante_preco: variante?.preco_adicional,
      complementos: complementoItems,
      tempo_preparo_min: produto.tempo_preparo_min || 30,
      pontos: produto.pontos || 0,
    })

    // Reset
    setQuantidade(1)
    setComplementosSelecionados({})
    onClose()
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md bg-white rounded-3xl z-50 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header com imagem */}
        <div className="relative">
          {produto.imagem_url ? (
            <img
              src={produto.imagem_url}
              alt={produto.nome}
              className="w-full h-48 object-cover"
            />
          ) : (
            <div className="w-full h-48 bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
              <span className="text-7xl">🍽️</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/90 rounded-full shadow-lg hover:bg-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5">
          <h2 className="text-xl font-bold">{produto.nome}</h2>
          {produto.descricao && (
            <p className="text-gray-600 mt-2">{produto.descricao}</p>
          )}

          {/* ⏱️ Tempo de preparo */}
          {produto.tempo_preparo_min && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-sm text-amber-800">
                Pronto em <strong>{produto.tempo_preparo_min} min</strong>
              </span>
            </div>
          )}

          {/* Variantes */}
          {variantes.length > 0 && (
            <div className="mt-5">
              <h3 className="font-semibold text-sm mb-2">Selecione o tamanho</h3>
              <div className="flex flex-wrap gap-2">
                {variantes.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVarianteSelecionada(v.id)}
                    className={`px-4 py-2 rounded-full border-2 font-medium transition-all ${
                      varianteSelecionada === v.id
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    {v.nome}
                    {v.preco_adicional > 0 && (
                      <span className="ml-1 text-sm opacity-70">
                        + {formatCurrency(v.preco_adicional)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Complementos */}
          {complementos.length > 0 && (
            <div className="mt-5">
              <h3 className="font-semibold text-sm mb-2">Adicionais</h3>
              <div className="space-y-2">
                {complementos.map((comp) => (
                  <button
                    key={comp.id}
                    onClick={() => toggleComplemento(comp.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      complementosSelecionados[comp.id]
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        complementosSelecionados[comp.id]
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300'
                      }`}>
                        {complementosSelecionados[comp.id] && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="font-medium">{comp.nome}</span>
                    </div>
                    <span className="font-semibold text-green-600">
                      + {formatCurrency(comp.preco)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-5 space-y-4">
          {/* Quantidade */}
          <div className="flex items-center justify-between">
            <span className="font-semibold">Quantidade</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantidade(q => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-gray-50"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="font-bold text-xl w-8 text-center">{quantidade}</span>
              <button
                onClick={() => setQuantidade(q => q + 1)}
                className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-gray-50"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Adicionar */}
          <button
            onClick={adicionar}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg"
            style={{
              background: paletaCor || '#16A34A',
              boxShadow: '0 8px 24px -8px rgba(22,163,74,.5)',
            }}
          >
            Adicionar {formatCurrency(total)}
          </button>
        </div>
      </div>
    </>
  )
}
