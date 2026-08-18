'use client'

import { useState, useEffect } from 'react'
import { Store, ChevronDown } from 'lucide-react'

interface Loja {
  id: string
  tenant_id: string
  tenant: {
    id: string
    nome: string
    slug: string
    logo_url: string | null
    cor_principal: string | null
    status: string
  }
}

export function LojaSwitcher() {
  const [lojas, setLojas] = useState<Loja[]>([])
  const [lojaAtiva, setLojaAtiva] = useState<Loja | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user-lojas')
      .then(r => r.json())
      .then(data => {
        setLojas(data.lojas || [])
        // Loja ativa = primeira ou salva em localStorage
        const saved = localStorage.getItem('loja_ativa')
        const found = saved ? data.lojas?.find((l: Loja) => l.tenant_id === saved) : null
        setLojaAtiva(found || data.lojas?.[0] || null)
        setLoading(false)
      })
  }, [])

  async function trocarLoja(loja: Loja) {
    const response=await fetch('/api/user-lojas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenant_id:loja.tenant_id})})
    if(!response.ok)return
    setLojaAtiva(loja)
    localStorage.setItem('loja_ativa', loja.tenant_id)
    setOpen(false)
    window.location.reload() // refresh para re-aplicar RLS
  }

  if (loading || !lojaAtiva || lojas.length <= 1) {
    return lojas.length === 1 && lojaAtiva ? (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100">
        <Store size={16} />
        <span className="text-sm font-medium">{lojaAtiva.tenant.nome}</span>
      </div>
    ) : null
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        <Store size={16} />
        <span className="text-sm font-medium">{lojaAtiva.tenant.nome}</span>
        <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-2xl shadow-xl border z-20 overflow-hidden">
            <p className="text-xs text-gray-500 px-3 py-2">Suas lojas</p>
            {lojas.map(l => (
              <button
                key={l.id}
                onClick={() => trocarLoja(l)}
                className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 ${
                  l.tenant_id === lojaAtiva.tenant_id ? 'bg-green-50' : ''
                }`}
              >
                <div className="size-8 rounded-lg flex items-center justify-center text-white font-bold" style={{ background: l.tenant.cor_principal || '#16A34A' }}>
                  {l.tenant.nome[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{l.tenant.nome}</p>
                  <p className="text-xs text-gray-500">@{l.tenant.slug}</p>
                </div>
                {l.tenant_id === lojaAtiva.tenant_id && (
                  <span className="text-xs text-green-600 font-bold">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
