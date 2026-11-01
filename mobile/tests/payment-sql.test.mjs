import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const tenant='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',user='20000000-0000-4000-8000-000000000001',order='30000000-0000-4000-8000-000000000001'
const db=new PGlite()
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE TABLE tenants(id uuid PRIMARY KEY,status text,bloqueado boolean DEFAULT false);
 CREATE TABLE usuarios_loja(tenant_id uuid,user_id uuid,ativo boolean,role text);
 CREATE TABLE pedidos(id uuid PRIMARY KEY,tenant_id uuid,deleted_at timestamptz,pago boolean DEFAULT false,pago_em timestamptz,pago_por text,codigo text,valor_total numeric,forma_pagamento text[]);
 CREATE TABLE movimentacoes_financeiras(id int GENERATED ALWAYS AS IDENTITY,tenant_id uuid,tipo text,descricao text,valor numeric,data date,categoria text,referencia_id uuid,forma_pagamento text);
 GRANT USAGE ON SCHEMA auth,public TO authenticated; GRANT SELECT ON tenants,usuarios_loja TO authenticated; GRANT SELECT,UPDATE ON pedidos TO authenticated; GRANT SELECT,INSERT,DELETE ON movimentacoes_financeiras TO authenticated; GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
 INSERT INTO tenants VALUES('${tenant}','active',false),('${other}','active',false);
 INSERT INTO usuarios_loja VALUES('${tenant}','${user}',true,'owner');
 INSERT INTO pedidos(id,tenant_id,codigo,valor_total,forma_pagamento) VALUES('${order}','${tenant}','TESTE',30,ARRAY['pix']);
 ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY; CREATE POLICY own_orders ON pedidos TO authenticated USING (tenant_id IN (SELECT tenant_id FROM usuarios_loja WHERE user_id=auth.uid() AND ativo));
 ALTER TABLE movimentacoes_financeiras ENABLE ROW LEVEL SECURITY; CREATE POLICY own_ledger ON movimentacoes_financeiras TO authenticated USING (tenant_id IN (SELECT tenant_id FROM usuarios_loja WHERE user_id=auth.uid() AND ativo));`)
await db.exec(await fs.readFile(new URL('../../supabase/migrations/095_mobile_pagamento_atomico.sql',import.meta.url),'utf8'))
await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',false)`)
const mark=paid=>db.query('select public.mobile_marcar_pedido_pago($1,$2,$3) result',[tenant,order,paid])
test('Real SQL marks paid and creates exactly one cash entry across repeated requests',async()=>{
 await mark(true);await mark(true);assert.equal((await db.query('select pago from pedidos')).rows[0].pago,true);assert.equal((await db.query('select count(*)::int n from movimentacoes_financeiras')).rows[0].n,1)
 await mark(false);await mark(false);assert.equal((await db.query('select pago from pedidos')).rows[0].pago,false);assert.equal((await db.query('select count(*)::int n from movimentacoes_financeiras')).rows[0].n,0)
})
test('Real SQL rolls payment back if the cash entry cannot be saved',async()=>{
 await db.exec("RESET ROLE; ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT fail_fixture CHECK(valor<0); SET ROLE authenticated")
 await assert.rejects(mark(true));assert.equal((await db.query('select pago from pedidos')).rows[0].pago,false)
 await db.exec('RESET ROLE; ALTER TABLE movimentacoes_financeiras DROP CONSTRAINT fail_fixture; SET ROLE authenticated')
})
test('Real SQL rejects another store, an inactive membership and a blocked store',async()=>{
 await assert.rejects(db.query('select public.mobile_marcar_pedido_pago($1,$2,true)',[other,order]))
 await db.exec('RESET ROLE; UPDATE usuarios_loja SET ativo=false; SET ROLE authenticated');await assert.rejects(mark(true))
 await db.exec('RESET ROLE; UPDATE usuarios_loja SET ativo=true; UPDATE tenants SET bloqueado=true; SET ROLE authenticated');await assert.rejects(mark(true))
 await db.exec('RESET ROLE; UPDATE tenants SET bloqueado=false; SET ROLE authenticated')
})
test('Anonymous execution is denied by the function ACL',async()=>{
 await db.exec('RESET ROLE; SET ROLE anon');await assert.rejects(mark(true));await db.exec('RESET ROLE; SET ROLE authenticated')
})
