'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { adminFetch } from '@/lib/admin-fetch'
import { MERCADO_PAGO_WEBHOOK_URL } from '@/lib/assinaturas'

type Conexao = { conectado: boolean; webhookValidado: boolean; contaId: string | null }
const erroConsulta = 'Não foi possível carregar o status do Mercado Pago.'

async function consultar(signal?: AbortSignal): Promise<Conexao> {
  const resposta = await adminFetch('/api/admin/mercado-pago', { cache: 'no-store', signal })
  if (!resposta.ok) throw Error(erroConsulta)
  return resposta.json()
}

export default function CheckoutMercadoPago() {
  const [conexao, setConexao] = useState<Conexao | null>(null)
  const [editar, setEditar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  function atualizar() {
    void consultar().then(resultado => {
      setConexao(resultado)
      setErro('')
    }).catch(() => setErro(erroConsulta))
  }

  useEffect(() => {
    const controller = new AbortController()
    void consultar(controller.signal).then(setConexao).catch(() => {
      if (!controller.signal.aborted) setErro(erroConsulta)
    })
    return () => controller.abort()
  }, [])

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (salvando) return
    const formulario = event.currentTarget
    const dados = new FormData(formulario)
    setSalvando(true)
    setErro('')
    try {
      const resposta = await adminFetch('/api/admin/mercado-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: dados.get('accessToken'), webhookSecret: dados.get('webhookSecret') }),
      })
      const resultado = await resposta.json()
      if (!resposta.ok) throw Error(resultado.error || 'Não foi possível salvar a conexão.')
      setConexao(resultado)
      formulario.reset()
      setEditar(false)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível salvar a conexão.')
    } finally {
      setSalvando(false)
    }
  }

  const pendente = conexao?.conectado && !conexao.webhookValidado
  const status = !conexao ? 'Carregando status…' : conexao.webhookValidado ? 'Conectado'
    : pendente ? 'Aguardando teste do webhook' : 'Aguardando configuração'

  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Checkout Pro do Mercado Pago</h3>
          {(!erro || conexao) && <p className="hint text-sm" role="status">{status}{conexao?.contaId ? ` · Conta ${conexao.contaId}` : ''}</p>}
        </div>
        {conexao && !editar && (
          <button type="button" className="btn-primary" onClick={() => { setErro(''); setEditar(true) }}>
            {conexao.conectado ? 'Atualizar conexão' : 'Vincular Mercado Pago'}
          </button>
        )}
      </div>

      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      {!conexao && erro && <button type="button" className="btn-ghost" onClick={atualizar}>Tentar novamente</button>}

      {(editar || pendente) && <>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Selecione sua aplicação do Checkout Pro em <a className="link" href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer">Suas integrações</a>.</li>
          <li>Em <strong>Webhooks → Produção</strong>, salve a URL abaixo com o evento <strong>Pagamentos</strong>.</li>
          <li>Salve as credenciais aqui. Depois, use <strong>Simular notificação</strong> no Mercado Pago e clique em <strong>Verificar status</strong>.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <code className="break-all text-xs">{MERCADO_PAGO_WEBHOOK_URL}</code>
          <button type="button" className="btn-ghost text-sm" onClick={async () => {
            try { await navigator.clipboard.writeText(MERCADO_PAGO_WEBHOOK_URL); setCopiado(true) }
            catch { setErro('Selecione o endereço e copie manualmente.') }
          }}>{copiado ? 'URL copiada' : 'Copiar URL'}</button>
        </div>
      </>}

      {editar && <form onSubmit={salvar} className="space-y-3">
        <label className="block text-sm">Access Token de produção
          <input name="accessToken" type="password" autoComplete="off" required maxLength={510} />
        </label>
        <label className="block text-sm">Assinatura secreta do webhook
          <input name="webhookSecret" type="password" autoComplete="off" required maxLength={256} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? 'Validando…' : 'Salvar conexão'}</button>
          <button type="button" className="btn-ghost" disabled={salvando} onClick={() => { setEditar(false); setErro('') }}>Cancelar</button>
        </div>
      </form>}

      {!editar && pendente && <button type="button" className="btn-ghost" onClick={atualizar}>Verificar status</button>}
    </section>
  )
}
