'use client'

import { useState, useEffect } from 'react'
import { ScrollText, Filter } from 'lucide-react'

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTabela, setFiltroTabela] = useState('')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)
    const res = await fetch('/api/auditoria')
    const data = await res.json()
    setLogs(data.logs || [])
    setLoading(false)
  }

  const logsFiltrados = logs.filter(l =>
    !filtroTabela || l.tabela === filtroTabela
  )

  const tabelas = Array.from(new Set(logs.map(l => l.tabela)))

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow mb-2">Auditoria</div>
        <h1 className="text-2xl font-semibold">Histórico de ações</h1>
        <p className="hint mt-1">Registros de todas as ações importantes executadas na sua loja</p>
      </div>

      <div className="flex items-center gap-3">
        <Filter size={16} className="text-gray-400" />
        <select value={filtroTabela} onChange={e => setFiltroTabela(e.target.value)} className="px-3 py-2 border rounded-xl">
          <option value="">Todas as tabelas</option>
          {tabelas.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="glass-soft rounded-2xl overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-gray-500">Carregando...</p>
        ) : logsFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Nenhum registro ainda</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-600">
                <th className="p-3">Quando</th>
                <th className="p-3">Ação</th>
                <th className="p-3">Tabela</th>
                <th className="p-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logsFiltrados.map(log => (
                <tr key={log.id} className="border-t text-sm">
                  <td className="p-3 text-gray-600">{new Date(log.criado_em).toLocaleString('pt-BR')}</td>
                  <td className="p-3 font-medium">{log.acao}</td>
                  <td className="p-3">{log.tabela}</td>
                  <td className="p-3 text-gray-500 text-xs">
                    {log.dados_novos ? JSON.stringify(log.dados_novos).slice(0, 100) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
