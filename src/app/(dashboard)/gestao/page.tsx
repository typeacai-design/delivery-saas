'use client'

import { Sparkles } from 'lucide-react'
import MateriaPrimaTab from '@/components/admin/MateriaPrimaTab'

export default function GestaoPage() {
  return (
    <div>
      <div className="glass-iridescent px-7 py-7 mb-5 relative">
        <div className="relative z-10">
          <div className="eyebrow mb-2 flex items-center gap-1.5"><Sparkles size={11}/>Operação</div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Matéria-prima</h1>
          <p className="hint mt-2">Cadastro, custo e saldo dos insumos usados nos produtos.</p>
        </div>
      </div>

      <MateriaPrimaTab />
    </div>
  )
}