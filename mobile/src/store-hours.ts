// Schedule and manual override expiry copied from the website dashboard.
export function storeHours(config: any): { aberto: boolean; horarioMsg: string } {
  const horariosDias = config?.horarios_dias
  const horarioLegado = config?.horario || { abre: '08:00', fecha: '22:00' }

  // Se não há horários configurados, loja fica FECHADA
  if (!horariosDias || Object.keys(horariosDias).length === 0) {
    return { aberto: false, horarioMsg: '' }
  }

  // Usar timezone do Brasil
  const agora = new Date()
  const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const diaAtual = brasilia.getDay()
  const minutosAgora = brasilia.getHours() * 60 + brasilia.getMinutes()

  // Mapear dia da semana (0-6) para chave
  const DIAS_CHAVES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
  const chaveDia = DIAS_CHAVES[diaAtual]

  // Pegar horários do dia
  let horariosDia = horariosDias[chaveDia]

  // Se não encontrar pelo nome, tenta pelo índice numérico
  if (!horariosDia && Array.isArray(horariosDias)) {
    horariosDia = horariosDias.find((item: any) => Number(item.dia ?? item.dia_semana) === diaAtual)
  }

  // Parse do horário
  const parseTime = (s: any) => {
    if (!s) return null
    const parts = String(s).split(':').map(Number)
    return parts.length >= 2 ? parts[0] * 60 + parts[1] : null
  }

  const inicioMin = parseTime(horariosDia?.abre || horariosDia?.inicio) ?? parseTime(horarioLegado.abre) ?? 480
  const fimMin = parseTime(horariosDia?.fecha || horariosDia?.fim) ?? parseTime(horarioLegado.fecha) ?? 1320

  // Verificar se o dia está marcado como inativo
  const diaInativo = horariosDia?.ativo === false
  const dentroHorario = !diaInativo && minutosAgora >= inicioMin && minutosAgora <= fimMin

  // Mensagem do horário
  const abre = horariosDia?.abre || horariosDia?.inicio || horarioLegado.abre || '08:00'
  const fecha = horariosDia?.fecha || horariosDia?.fim || horarioLegado.fecha || '22:00'
  const horarioMsg = diaInativo ? `${chaveDia} - Fechado` : `${abre} - ${fecha}`

  return { aberto: dentroHorario, horarioMsg }
}

// ---------------------------------------------------------------------------
// Calcula o timestamp em que um override manual deve expirar.
//
// tipo === 'abrir'  -> loja foi aberta manualmente. Expira no proximo
//                       horario PROGRAMADO de fechamento (do dia atual
//                       se ainda nao fechou, senao do proximo dia ativo).
// tipo === 'fechar' -> loja foi fechada manualmente. Expira no proximo
//                       horario PROGRAMADO de abertura (hoje se ainda nao
//                       abriu, senao no proximo dia ativo).
//
// Retorna Date ou null se nenhum horario configurado.
// ---------------------------------------------------------------------------
export function overrideExpiry(
  horariosDias: any,
  tipo: 'abrir' | 'fechar'
): Date | null {
  if (!horariosDias || Object.keys(horariosDias).length === 0) return null

  const agora = new Date()
  // Minutos de hoje no fuso de Brasilia (mesmo criterio do verificarLojaAbertaPorHorario)
  const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const diaAtualIdx = brasilia.getDay()
  const minutosHoje = brasilia.getHours() * 60 + brasilia.getMinutes()

  const parseTime = (s: any): number | null => {
    if (!s) return null
    const parts = String(s).split(':').map(Number)
    return parts.length >= 2 ? parts[0] * 60 + parts[1] : null
  }

  const DIAS_CHAVES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

  // Tenta encontrar o slot do dia. Aceita formato {seg:{abre,fecha,ativo}} ou array.
  const slotDoDia = (diaIdx: number): any => {
    const chave = DIAS_CHAVES[diaIdx]
    const item = horariosDias[chave]
    if (item) return item
    if (Array.isArray(horariosDias)) {
      return horariosDias.find((x: any) => Number(x.dia ?? x.dia_semana) === diaIdx)
    }
    return null
  }

  // Calcula a diferenca em dias entre hoje (Brasilia) e o dia destino
  const diffDias = (diaDestinoIdx: number): number => {
    let diff = (diaDestinoIdx - diaAtualIdx + 7) % 7
    return diff
  }

  // Constrói um Date em Brasilia (UTC-3) para dia+hora especificados
  const diaParaTimestamp = (diaIdx: number, minutos: number): Date => {
    // Pega o inicio do dia de hoje em Brasilia
    const inicioHojeBrasilia = new Date(brasilia)
    inicioHojeBrasilia.setHours(0, 0, 0, 0)
    // Soma os dias (em horario local do servidor; servidor roda em UTC, mas
    // brasilia ja tem offset -3 embutido no .toLocaleString -- entao a hora
    // do servidor reflete a hora local de Brasilia).
    const target = new Date(inicioHojeBrasilia)
    target.setDate(target.getDate() + diffDias(diaIdx))
    target.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0)
    return target
  }

  if (tipo === 'abrir') {
    // Precisa achar o proximo horario de FECHAMENTO programado (fecha >= agora)
    // Tenta hoje primeiro
    const slotHoje = slotDoDia(diaAtualIdx)
    if (slotHoje && slotHoje.ativo !== false) {
      const fimMin = parseTime(slotHoje.fecha || slotHoje.fim)
      if (fimMin != null && fimMin > minutosHoje) {
        return diaParaTimestamp(diaAtualIdx, fimMin)
      }
    }
    // Senao, procura o proximo dia ativo
    for (let i = 1; i <= 7; i++) {
      const diaIdx = (diaAtualIdx + i) % 7
      const slot = slotDoDia(diaIdx)
      if (slot && slot.ativo !== false) {
        const fimMin = parseTime(slot.fecha || slot.fim)
        if (fimMin != null) return diaParaTimestamp(diaIdx, fimMin)
      }
    }
    return null
  }

  // tipo === 'fechar'
  // Precisa achar o proximo horario de ABERTURA programado (abre >= agora)
  const slotHoje = slotDoDia(diaAtualIdx)
  if (slotHoje && slotHoje.ativo !== false) {
    const inicioMin = parseTime(slotHoje.abre || slotHoje.inicio)
    if (inicioMin != null && inicioMin > minutosHoje) {
      return diaParaTimestamp(diaAtualIdx, inicioMin)
    }
  }
  for (let i = 1; i <= 7; i++) {
    const diaIdx = (diaAtualIdx + i) % 7
    const slot = slotDoDia(diaIdx)
    if (slot && slot.ativo !== false) {
      const inicioMin = parseTime(slot.abre || slot.inicio)
      if (inicioMin != null) return diaParaTimestamp(diaIdx, inicioMin)
    }
  }
  return null
}

