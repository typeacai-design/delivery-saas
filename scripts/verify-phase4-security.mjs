import fs from 'node:fs'
const read = file => fs.readFileSync(file, 'utf8')
const migration = read('supabase/migrations/049_avaliacao_tokens_hash.sql')
const removal = read('supabase/migrations/050_remove_plaintext_review_tokens.sql')
const reviews = read('src/app/api/avaliacoes/public/route.ts')
const limiter = read('src/lib/customer-identity.ts')
const config = read('next.config.ts')
const proxy = read('src/proxy.ts')
const invite = read('src/app/api/pedidos/[id]/avaliacao-convite/route.ts')
const checks = [
 ['rate limiter RPC prerequisite', migration.includes("to_regprocedure('public.consume_api_rate_limit(text,integer,integer)')")],
 ['portable pgcrypto schema resolution', migration.includes("e.extname = 'pgcrypto'") && migration.includes("format('select pg_catalog.encode(%I.digest")],
 ['review token hash backfill', migration.includes('avaliacao_token_hash = public.hash_review_token(')],
 ['review expiry and consumption', migration.includes('avaliacao_token_expires_at') && migration.includes('avaliacao_token_used_at')],
 ['review API hash-only lookup', reviews.includes("eq('avaliacao_token_hash', tokenHash)") && !reviews.includes("eq('avaliacao_token', token)")],
 ['rate limiter fails closed', limiter.includes("console.error('rate_limit_rpc_required'") && !limiter.includes('localRateLimited')],
 ['no-referrer config', config.includes("source: '/avaliar/:path*'") && config.includes("value: 'no-referrer'")],
 ['no-referrer runtime proxy', proxy.includes("pathname.startsWith('/avaliar/')") && proxy.includes("response.headers.set('Referrer-Policy', 'no-referrer')")],
 ['plaintext removed at rest', removal.includes('drop column if exists avaliacao_token') && removal.includes('set avaliacao_token = null')],
 ['authenticated one-time rotation', invite.includes('authenticatedTenant(MANAGEMENT_ROLES)') && invite.includes('randomBytes(32)') && !invite.includes('avaliacao_token:')],
]
for (const [name, ok] of checks) { if (!ok) throw new Error(`FAIL: ${name}`); console.log(`PASS: ${name}`) }