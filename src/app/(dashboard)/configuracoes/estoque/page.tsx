'use client'

import Link from 'next/link'
import { Package, ArrowRight } from 'lucide-react'

export default function EstoqueConfigPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="eyebrow mb-2">Configurações</div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
          Controle de Estoque
        </h1>
        <p className="hint">Gerencie o estoque dos seus produtos</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Info sobre configuração */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-800 mb-2">📦 Controle por produto</h3>
          <p className="text-blue-700 text-sm mb-4">
            Cada produto tem suas próprias configurações de estoque. Acesse o cadastro de produtos para definir se um item pode ser vendido mesmo sem estoque.
          </p>
          <div className="bg-white/60 rounded-lg p-4 text-sm space-y-2">
            <p><strong>• Item sempre disponível:</strong> o produto é vendido mesmo sem controle de estoque</p>
            <p><strong>• Em estoque (controlar qtd):</strong> o sistema só permite venda se houver estoque disponível</p>
          </div>
        </div>

        {/* Link para gestão de produtos */}
        <div className="glass p-6">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-xl bg-green-100 flex items-center justify-center">
              <Package className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Cadastro de Produtos</h3>
              <p className="text-sm text-gray-500">Gerencie produtos, preços e estoque</p>
            </div>
            <Link href="/produtos" className="btn-primary flex items-center gap-2">
              Acessar
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Link para insumos */}
        <div className="glass p-6">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Package className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Matéria-Prima</h3>
              <p className="text-sm text-gray-500">Controle de insumos e alertas de estoque baixo</p>
            </div>
            <Link href="/materia-prima" className="btn-primary flex items-center gap-2">
              Acessar
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
