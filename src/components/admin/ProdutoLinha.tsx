'use client'

import { useState } from 'react'
import { Edit, Trash2, Image as ImageIcon, Copy, Check, X, Save } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Props = {
  produto: any
  complementosCount: number
  onEdit: () => void
  onToggleAtivo: () => void | Promise<void>
  onDuplicate: () => void | Promise<void>
  onUpdate: (field: string, value: any) => void | Promise<void>
  onDelete: () => void
}

/**
 * Linha enxuta do produto na lista.
 * Mostra: foto, título (editável inline), ordem (editável inline),
 * preço (editável inline), pontos, etiquetas Mesa/Delivery/Retirada,
 * qtd de complementos, e botões Editar / Duplicar / Ativar-Desativar / Apagar.
 */
export default function ProdutoLinha({
  produto,
  complementosCount,
  onEdit,
  onToggleAtivo,
  onDuplicate,
  onUpdate,
  onDelete,
}: Props) {
  const [editandoCampo, setEditandoCampo] = useState<string | null>(null)
  const [valorTemp, setValorTemp] = useState<string>('')

  const iniciarEdicao = (campo: string, valorAtual: any) => {
    setEditandoCampo(campo)
    setValorTemp(String(valorAtual ?? ''))
  }

  const cancelar = () => {
    setEditandoCampo(null)
    setValorTemp('')
  }

  const salvar = async () => {
    if (!editandoCampo) return
    let v: any = valorTemp
    if (editandoCampo === 'preco' || editandoCampo === 'ordem' || editandoCampo === 'pontos') {
      v = valorTemp === '' ? 0 : Number(valorTemp)
    }
    await onUpdate(editandoCampo, v)
    setEditandoCampo(null)
    setValorTemp('')
  }

  const EditavelInline = ({ campo, valor, className, prefixo }: any) => {
    if (editandoCampo === campo) {
      return (
        <div className="flex items-center gap-1">
          {prefixo && <span className="hint text-xs">{prefixo}</span>}
          <input
            type={campo === 'nome' ? 'text' : 'number'}
            value={valorTemp}
            onChange={(e) => setValorTemp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') salvar()
              if (e.key === 'Escape') cancelar()
            }}
            autoFocus
            className="form-input !py-0.5 !px-1 !text-sm w-20"
          />
          <button
            onClick={salvar}
            className="size-5 rounded flex items-center justify-center bg-green-600 text-white hover:bg-green-700"
          >
            <Check size={10} strokeWidth={3} />
          </button>
          <button
            onClick={cancelar}
            className="size-5 rounded flex items-center justify-center bg-gray-200 text-gray-700 hover:bg-gray-300"
          >
            <X size={10} strokeWidth={3} />
          </button>
        </div>
      )
    }
    return (
      <button
        onClick={() => iniciarEdicao(campo, valor)}
        className={`hover:bg-black/5 rounded px-1 -mx-1 transition ${className}`}
        title="Clique para editar"
      >
        {prefixo && <span className="hint text-xs mr-0.5">{prefixo}</span>}
        {valor}
      </button>
    )
  }

  return (
    <div className="bg-white rounded-2xl border p-3 flex items-center gap-3 hover:shadow-md transition" style={{ borderColor: '#E5E7EB' }}>
      {/* Foto */}
      {produto.imagem_url ? (
        <img src={produto.imagem_url} alt={produto.nome} className="size-12 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="size-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <ImageIcon size={18} className="text-gray-400" />
        </div>
      )}

      {/* Nome + complementos chip + etiquetas */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">
          <EditavelInline campo="nome" valor={produto.nome} />
        </div>
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {/* Etiquetas Mesa/Delivery/Retirada */}
          {produto.disponivel_mesa && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">Mesa</span>
          )}
          {produto.disponivel_delivery && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">Delivery</span>
          )}
          {produto.disponivel_retirada && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">Retirada</span>
          )}
          {complementosCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">
              {complementosCount} complemento{complementosCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Ordem editável */}
      <div className="text-xs text-gray-500 flex flex-col items-center">
        <span className="hint">Ordem</span>
        <EditavelInline campo="ordem" valor={produto.ordem ?? 0} />
      </div>

      {/* Preço editável */}
      <div className="text-sm font-bold text-gray-900 text-right min-w-[80px]">
        <div className="hint text-xs font-normal">Preço</div>
        <EditavelInline
          campo="preco"
          valor={formatCurrency(Number(produto.preco))}
          prefixo="R$"
        />
      </div>

      {/* Pontos editável */}
      {Number(produto.pontos) > 0 && (
        <div className="text-xs flex flex-col items-center min-w-[50px]">
          <span className="hint">Pontos</span>
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-100 text-green-800 text-sm font-bold">
            {produto.pontos}
          </span>
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="size-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600"
          title="Editar"
        >
          <Edit size={14} />
        </button>
        <button
          onClick={onDuplicate}
          className="size-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600"
          title="Duplicar"
        >
          <Copy size={14} />
        </button>
        <Switch
          checked={!!produto.ativo}
          onChange={() => onToggleAtivo()}
        />
        <button
          onClick={onDelete}
          className="size-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-600"
          title="Apagar"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="w-10 h-5 rounded-full transition relative shrink-0"
      style={{ background: checked ? '#16A34A' : '#D1D5DB' }}
      title={checked ? 'Desativar' : 'Ativar'}
    >
      <div
        className="size-4 rounded-full bg-white absolute top-0.5 transition-all shadow"
        style={{ left: checked ? '20px' : '2px' }}
      />
    </button>
  )
}
