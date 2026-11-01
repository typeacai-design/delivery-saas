import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const own='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',user='20000000-0000-4000-8000-000000000001'
test('Real operational policies and profile RPCs keep two merchants isolated without granting private profile columns',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
 CREATE TABLE memberships(tenant_id uuid,user_id uuid,role text,active boolean);INSERT INTO memberships VALUES('${own}','${user}','owner',true);
 CREATE FUNCTION has_active_tenant_role(t uuid,r text[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.memberships WHERE tenant_id=t AND user_id=auth.uid() AND active AND role=ANY(r)) $$;
 CREATE TABLE tenants(id uuid PRIMARY KEY,status text,bloqueado boolean,tempo_preparo_extra_minutos int,nome text,cpf text,cnpj text,categoria text,tipo_estabelecimento text,logo_url text,telefone text,endereco text,numero text,cidade text,estado text,bairro text,complemento text,cep text,slug text,email text,nome_responsavel text,created_at timestamptz,updated_at timestamptz);
 INSERT INTO tenants(id,status,bloqueado,nome,slug,email) VALUES('${own}','active',false,'Own','ownstore','own@example.test'),('${other}','active',false,'Other','otherstore','other@example.test');
 CREATE TABLE pedidos(id int,tenant_id uuid,tipo_pedido text);CREATE TABLE sessoes_mesa(id int,tenant_id uuid,nome text);CREATE TABLE dias_pico(id int,tenant_id uuid,nome text);
 INSERT INTO sessoes_mesa VALUES(1,'${own}','Own'),(2,'${other}','Other');INSERT INTO dias_pico VALUES(1,'${own}','Own'),(2,'${other}','Other');
 GRANT SELECT,INSERT,UPDATE,DELETE ON sessoes_mesa,dias_pico TO authenticated,anon;`)
 const files=(await fs.readdir('migrations')).filter(f=>f.endsWith('.sql')).sort();for(const f of files)await db.exec(await fs.readFile('migrations/'+f,'utf8'))
 await db.exec(`SET ROLE authenticated;SELECT set_config('test.actor','${user}',false)`)
 assert.equal((await db.query('select * from sessoes_mesa')).rows.length,1);assert.equal((await db.query('select * from dias_pico')).rows.length,1)
 assert.equal((await db.query("update sessoes_mesa set nome='changed' where id=2 returning id")).rows.length,0);await assert.rejects(db.query('update dias_pico set tenant_id=$1 where id=1',[other]))
 assert.equal((await db.query('select mobile_perfil_loja($1) p',[own])).rows[0].p.email,'own@example.test');await assert.rejects(db.query('select email from tenants'));await assert.rejects(db.query('select mobile_perfil_loja($1)',[other]));await assert.rejects(db.query('select mobile_salvar_perfil_loja($1,$2)',[own,{nome:'New',slug:'ownstore',status:'active'}]));await assert.rejects(db.query('select mobile_salvar_perfil_loja($1,$2)',[own,{nome:'New',slug:'otherstore'}]));await db.query('select mobile_salvar_perfil_loja($1,$2)',[own,{nome:'Changed',slug:'ownstore',cpf:'52998224725'}]);assert.equal((await db.query('select mobile_perfil_loja($1) p',[own])).rows[0].p.nome,'Changed')
 await db.exec(`RESET ROLE;UPDATE memberships SET active=false;SET ROLE authenticated`);assert.equal((await db.query('select * from sessoes_mesa')).rows.length,0);await assert.rejects(db.query('select mobile_perfil_loja($1)',[own]));await db.exec('RESET ROLE;SET ROLE anon');assert.equal((await db.query('select * from sessoes_mesa')).rows.length,0);assert.equal((await db.query('select * from dias_pico')).rows.length,0);await assert.rejects(db.query('select mobile_perfil_loja($1)',[own]))
 }finally{await db.close()}
})
