const { executeSql } = require('./lib/supabase-management')

async function run() {
  console.log('=== Corrigindo constraint sabores_maximo ===\n')

  // 1. Remover constraint antiga (só aceita 2 ou 3)
  console.log('Removendo constraint antiga...')
  await executeSql(`
    ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_sabores_maximo_check;
  `)

  // 2. Adicionar constraint nova (aceita 1 a 10)
  console.log('Adicionando constraint nova...')
  await executeSql(`
    ALTER TABLE public.produtos
    ADD CONSTRAINT produtos_sabores_maximo_check
    CHECK (sabores_maximo >= 1 AND sabores_maximo <= 10);
  `)

  // 3. Verificar
  console.log('Verificando constraint...')
  const { query } = require('./lib/supabase-management')
  const result = await query(`
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'produtos'::regclass
    AND conname = 'produtos_sabores_maximo_check'
  `)
  console.log('Constraint atual:', JSON.stringify(result, null, 2))

  // 4. Corrigir produtos com valores fora do range
  console.log('\nCorrigindo produtos com valores inválidos...')
  await executeSql(`
    UPDATE public.produtos SET sabores_maximo = 1
    WHERE sabores_maximo < 1 OR sabores_maximo > 10 OR sabores_maximo IS NULL;
  `)

  console.log('\n✅ Correção concluída!')
}

run().catch(e => {
  console.error('Erro:', e.message)
  process.exit(1)
})
