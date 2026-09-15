const { executeSql, query } = require('./lib/supabase-management')

async function run() {
  console.log('=== Aplicando migration 093 (perfil atendimento) ===\n')

  // Verificar se constraint atual tem 'atendimento'
  const before = await query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'membros_equipe'::regclass
    AND conname = 'membros_equipe_perfil_check'
  `)
  console.log('Antes:', JSON.stringify(before, null, 2))

  // Aplicar migration
  await executeSql(`
    ALTER TABLE public.membros_equipe DROP CONSTRAINT IF EXISTS membros_equipe_perfil_check;
    ALTER TABLE public.membros_equipe
      ADD CONSTRAINT membros_equipe_perfil_check
      CHECK (perfil IN ('owner', 'manager', 'attendant', 'cozinha', 'motoboy', 'atendimento'));
  `)

  // Verificar depois
  const after = await query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'membros_equipe'::regclass
    AND conname = 'membros_equipe_perfil_check'
  `)
  console.log('\nDepois:', JSON.stringify(after, null, 2))
  console.log('\n✅ Migration aplicada!')
}

run().catch(e => {
  console.error('Erro:', e.message)
  process.exit(1)
})
