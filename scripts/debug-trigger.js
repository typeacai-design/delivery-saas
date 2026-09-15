const { executeSql, query } = require('./lib/supabase-management')

async function run() {
  console.log('=== Verificando triggers e constraints ===\n')

  // Verificar triggers
  const triggers = await query(`
    SELECT
      tgname as trigger_name,
      proname as function_name
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE tgrelid = 'produtos'::regclass
  `)
  console.log('Triggers em produtos:')
  console.log(JSON.stringify(triggers, null, 2))

  // Verificar constraints
  const constraints = await query(`
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'produtos'::regclass
  `)
  console.log('\nConstraints em produtos:')
  console.log(JSON.stringify(constraints, null, 2))

  // Verificar function
  const functions = await query(`
    SELECT prosrc as source
    FROM pg_proc
    WHERE proname = 'validar_configuracao_sabores'
  `)
  console.log('\nFunction validar_configuracao_sabores:')
  console.log(JSON.stringify(functions, null, 2))

  // Testar INSERT diretamente
  console.log('\n=== Testando INSERT simples ===')
  try {
    const test = await query(`
      INSERT INTO produtos (tenant_id, nome, preco, sabores_maximo, ativo)
      VALUES ('test', 'TESTE DEBUG', 10.00, 1, true)
      RETURNING id
    `)
    console.log('INSERT funcionou:', test)
  } catch (e) {
    console.log('INSERT falhou:', e.message)
  }
}

run().catch(console.error)
