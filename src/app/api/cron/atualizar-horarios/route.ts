import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Dias da semana em português (0 = Domingo)
const DIAS_CHAVES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

// Função para verificar se está dentro do horário
function verificarHorarioFuncionamento(horariosDias: any, excecoes: any[]): boolean {
  const agora = new Date()
  // Usar timezone de Brasília
  const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const diaAtual = brasilia.getDay() // 0 = Domingo, 1 = Segunda, etc.
  const horaAtual = brasilia.getHours() * 60 + brasilia.getMinutes()
  const dataAtual = brasilia.toISOString().split('T')[0]

  // Verificar se é uma data com exceção (feriado, evento especial)
  if (excecoes && excecoes.length > 0) {
    const excecao = excecoes.find((ex: any) => ex.data === dataAtual)
    if (excecao) {
      const [hAbre, mAbre] = (excecao.abre || '00:00').split(':').map(Number)
      const [hFecha, mFecha] = (excecao.fecha || '23:59').split(':').map(Number)
      const horaAbre = hAbre * 60 + mAbre
      const horaFecha = hFecha * 60 + mFecha
      return horaAtual >= horaAbre && horaAtual < horaFecha
    }
  }

  // Verificar horário regular do dia
  const chaveDia = DIAS_CHAVES[diaAtual]
  const horarioDia = horariosDias?.[chaveDia]

  // Se o dia não está ativo, está fora do horário
  if (!horarioDia?.ativo) {
    return false
  }

  const [hAbre, mAbre] = (horarioDia.abre || '00:00').split(':').map(Number)
  const [hFecha, mFecha] = (horarioDia.fecha || '23:59').split(':').map(Number)
  const horaAbre = hAbre * 60 + mAbre
  const horaFecha = hFecha * 60 + mFecha

  return horaAtual >= horaAbre && horaAtual < horaFecha
}

export async function GET() {
  try {
    // Criar cliente admin para bypassar RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Buscar todos os tenants ativos
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('id, slug, config')
      .eq('status', 'active')

    if (error) {
      console.error('Erro ao buscar tenants:', error)
      return NextResponse.json({ error: 'Erro ao buscar tenants' }, { status: 500 })
    }

    let atualizados = 0
    const logs: string[] = []

    for (const tenant of tenants || []) {
      const config = (tenant.config || {}) as any

      // Se a loja já está aberta, não precisa fazer nada
      if (config.loja_aberta === true) {
        continue
      }

      // Verificar se está dentro do horário de funcionamento
      const dentroHorario = verificarHorarioFuncionamento(
        config.horarios_dias,
        config.excecoes_horario || []
      )

      // Se está dentro do horário, abrir a loja automaticamente
      if (dentroHorario) {
        const novoConfig = { ...config, loja_aberta: true }
        const { error: updateError } = await supabase
          .from('tenants')
          .update({ config: novoConfig })
          .eq('id', tenant.id)

        if (!updateError) {
          atualizados++
          logs.push(`Loja ${tenant.slug} aberta automaticamente (dentro do horário)`)
        }
      }
    }

    console.log(`[Cron] Verificação de horários: ${atualizados} loja(s) aberta(s) automaticamente`)

    return NextResponse.json({
      success: true,
      mensagem: `${atualizados} loja(s) aberta(s) automaticamente`,
      logs
    })

  } catch (error: any) {
    console.error('Erro no cron de horários:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
