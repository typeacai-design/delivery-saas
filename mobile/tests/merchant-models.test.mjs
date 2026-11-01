import test from 'node:test'
import assert from 'node:assert/strict'
import {homeSummary} from '../src/home-model.ts'
import {financeSummary} from '../src/finance-model.ts'
import {chooseRange,formatRange} from '../src/date-range-model.ts'
test('Dashboard keeps Sao Paulo midnight boundaries, excludes cancelled revenue, and counts the live queue',()=>{
 const result=homeSummary([{valor_total:30,pago:true,status:'entregue',forma_pagamento:['pix'],data_criacao:'2026-10-31T02:59:59Z'},{valor_total:40,pago:true,status:'entregue',forma_pagamento:['pix'],data_criacao:'2026-10-31T03:00:00Z'},{valor_total:100,pago:true,status:'cancelado',forma_pagamento:[],data_criacao:'2026-10-31T04:00:00Z'},{valor_total:20,pago:false,status:'novo',forma_pagamento:[],data_criacao:'2026-10-31T04:00:00Z'}],'2026-10-31')
 assert.equal(result.totalToday,40);assert.equal(result.totalMonth,70);assert.equal(result.paidToday,1);assert.equal(result.fresh,1);assert.equal(result.ongoing,1)
})
test('Cashflow does not count a paid order again when a linked native ledger entry exists',()=>{
 const r=financeSummary([{id:'a',codigo:'1',pago:true,status:'entregue',valor_total:30,created_at:'2026-10-31'}],[{id:'e',valor:5}],[{id:'t',referencia_id:'a',categoria:'venda',tipo:'entrada',valor:30}]);assert.equal(r.received,30);assert.equal(r.balance,25);assert.equal(r.rows.length,2)
})
test('Single range control supports reverse selection, same day, and a new range after completion',()=>{
 assert.deepEqual(chooseRange({from:'2026-10-31',to:''},'2026-10-01'),{from:'2026-10-01',to:'2026-10-31'});assert.deepEqual(chooseRange({from:'2026-10-31',to:''},'2026-10-31'),{from:'2026-10-31',to:'2026-10-31'});assert.deepEqual(chooseRange({from:'2026-10-01',to:'2026-10-31'},'2026-11-01'),{from:'2026-11-01',to:''});assert.equal(formatRange({from:'',to:''}),'Selecionar período')
})
