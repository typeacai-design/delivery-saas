import test from 'node:test'
import assert from 'node:assert/strict'
import { unzipSync,strFromU8 } from 'fflate'
import { brasiliaBounds,brasiliaDay,reportDefault,formatBrasilia } from '../src/lib/brasilia.ts'
import { buildReports,reportTabs } from '../src/lib/merchant-reports.ts'
import { reportWorkbook } from '../src/lib/report-workbook.ts'
const filters={from:'2026-11-01',to:'2026-11-20',status:'',payment:'',visits:'all'}
const at='2026-11-03T02:59:00Z'
const order=(id,extra={})=>({id,data_criacao:at,pago:true,status:'entregue',forma_pagamento:['pix'],valor_total:20,tipo_entrega:'delivery',...extra})
const orders=[order('a'),order('b',{forma_pagamento:[],valor_total:10}),order('c',{pago:false}),order('d',{status:'cancelado',motivo_cancelamento:'Cliente',cancelado_em:at}),order('e',{sessao_mesa_id:'s',valor_total:30,data_criacao:'2026-10-30T12:00:00Z'}),order('f',{sessao_mesa_id:'s',valor_total:20}),order('g',{forma_pagamento:['pix','dinheiro'],valor_pago:[5,15],valor_total:20}),order('h',{deleted_at:at})]
const sessions=[{id:'s',status:'fechada',data_fechamento:at,forma_pagamento:'dinheiro',valor_total:50}]
const items=[{pedido_id:'a',nome:'Açaí',quantidade:2,valor_unitario:5,complementos:[{nome:'Extra',valor:1,quantidade:2}],pedido_complementos:[{nome:'Extra',valor:1,quantidade:2}]},{pedido_id:'e',nome:'Mesa',quantidade:1,valor_unitario:30}]
const movements=[{tipo:'entrada',categoria:'venda',valor:20,referencia_id:'a'},{tipo:'entrada',categoria:'manual',valor:7},{tipo:'saida',valor:4,referencia_id:'expense'}]
const expenses=[{id:'expense',valor:4},{id:'second',valor:3}]
const visits=[{created_at:at},{created_at:'2026-11-03T03:00:00Z'}]
const build=(f=filters)=>buildReports(f,orders,sessions,items,movements,expenses,visits)
test('calendar boundaries are Brasilia regardless of runtime timezone',()=>{for(const tz of ['UTC','Asia/Tokyo','America/Los_Angeles']){process.env.TZ=tz;assert.equal(brasiliaDay(new Date('2026-11-01T02:59:00Z')),'2026-10-31');assert.deepEqual(reportDefault(new Date('2026-11-01T03:00:00Z')),{from:'2026-11-01',to:'2026-11-01'});assert.deepEqual(brasiliaBounds('2026-11-01','2026-11-01'),{start:'2026-11-01T03:00:00.000Z',end:'2026-11-02T03:00:00.000Z'});assert.equal(formatBrasilia('2026-11-01'),'01/11/2026')}})
test('paid sales, closed table once, historical items, financial and visits reconcile',()=>{const r=build();assert.equal(r.summary.vendas,100);assert.equal(r.summary.pedidos,4);assert.equal(r.summary.entradas,107);assert.equal(r.summary.saidas,7);assert.equal(r.summary.saldo,100);assert.equal(r.rows.periodo[0].nome,'2026-11-02');assert.equal(r.rows.modalidade.find(x=>x.nome==='mesa').total,50);assert.equal(r.rows.complemento[0].total,4);assert.equal(r.rows.item.find(x=>x.nome==='Mesa').total,30);assert.equal(r.rows.cancelamentos[0].qtd,1);assert.equal(r.visits.porDia.length,2);assert.equal(r.rows.pagamento.reduce((n,x)=>n+x.total,0),100)})
test('status, payment portions, missing payment and top days apply consistently',()=>{const p=build({...filters,payment:'pix'});assert.equal(p.summary.vendas,25);assert.equal(p.rows.pagamento.length,1);assert.equal(build({...filters,payment:'nao_informado'}).summary.vendas,10);const c=build({...filters,status:'cancelado'});assert.equal(c.summary.vendas,0);assert.equal(c.rows.cancelamentos.length,1);assert.equal(build({...filters,status:'entregue'}).rows.cancelamentos.length,0)})
test('xlsx contains all nine categories, summary, visuals, numeric cells and literal text',()=>{const r=build();r.rows.item.push({nome:'=literal & <nome>',qtd:1,total:3.5});const f=unzipSync(reportWorkbook(r));assert.equal(Object.keys(f).filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).length,reportTabs.length+2);const item=strFromU8(f['xl/worksheets/sheet4.xml']);assert.match(item,/=literal &amp; &lt;nome&gt;/);assert.match(item,/<v>3.5<\/v>/);assert.doesNotMatch(item,/<f>/)})
