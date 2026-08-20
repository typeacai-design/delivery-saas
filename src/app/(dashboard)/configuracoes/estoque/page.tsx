'use client'

import Link from 'next/link'
import { Package, ArrowRight, Box } from 'lucide-react'

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
        {/* Link para gestão de produtos */}
        <div className="glass p-6">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-xl bg-green-100 flex items-center justify-center">
              <Package className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Cadastro de Produtos</h3>
              <p className="text-sm text-gray-500">Gerencie produtos, preços e configure controle de estoque por produto</p>
            </div>
            <Link href="/cardapio" className="btn-primary flex items-center gap-2">
              Acessar
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Link para insumos */}
        <div className="glass p-6">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Box className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Matéria-Prima</h3>
              <p className="text-sm text-gray-500">Cadastre ingredientes e vincule aos produtos para controle de custo</p>
            </div>
            <Link href="/gestao" className="btn-primary flex items-center gap-2">
              Acessar
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
