'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react'

type Stage = { id: string; label: string; count: number }
export default function MerchantOrderStages({ stages, selected, onSelect }: {
  stages: Stage[]; selected: string; onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const index = Math.max(0, stages.findIndex(stage => stage.id === selected))
  const current = stages[index]
  if (!current) return null
  const choose = (id: string) => { onSelect(id); setExpanded(false) }
  return <div className="wd-order-stage-mobile">
    <div className="wd-stage-select">
      <button type="button" onClick={() => choose(stages[index - 1].id)} disabled={index === 0} aria-label="Etapa anterior"><ChevronLeft size={20} /></button>
      <button type="button" className="wd-stage-current" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="merchant-order-stage-options">
        <span><strong>{current.label} · {current.count}</strong></span><ChevronDown size={18} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => choose(stages[index + 1].id)} disabled={index === stages.length - 1} aria-label="Próxima etapa"><ChevronRight size={20} /></button>
    </div>
    {expanded && <div id="merchant-order-stage-options" className="wd-stage-options">
      <div className="wd-stage-options-title"><strong>Etapas dos pedidos</strong><button type="button" onClick={() => setExpanded(false)} aria-label="Fechar etapas"><X size={18} /></button></div>
      <div className="wd-stage-grid">{stages.map(stage => <button type="button" key={stage.id} onClick={() => choose(stage.id)} aria-pressed={selected === stage.id}>
        <span>{stage.label}</span><b>{stage.count}</b>
      </button>)}</div>
    </div>}
  </div>
}
