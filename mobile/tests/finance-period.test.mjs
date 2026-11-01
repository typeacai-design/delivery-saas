import test from 'node:test';
import assert from 'node:assert/strict';
import {currentMonthRange,financePeriodKey} from '../src/finance-period.ts';
import {discountAmount,reviewUrl} from '../src/order-actions-model.ts';
test('Current month uses real calendar ends, leap years, and December rollover',()=>{
 assert.deepEqual(currentMonthRange(new Date('2026-11-01T03:00:00Z')),{from:'2026-11-01',to:'2026-11-30'});
 assert.deepEqual(currentMonthRange(new Date('2026-10-01T02:59:59Z')),{from:'2026-09-01',to:'2026-09-30'});
 assert.deepEqual(currentMonthRange(new Date('2028-02-29T12:00:00Z')),{from:'2028-02-01',to:'2028-02-29'});
 assert.deepEqual(currentMonthRange(new Date('2027-01-01T03:00:00Z')),{from:'2027-01-01',to:'2027-01-31'});
});
test('Different periods and stores cannot share summary cache entries',()=>{
 assert.notEqual(financePeriodKey('a',{from:'2026-10-01',to:'2026-10-31'}),financePeriodKey('a',{from:'2026-11-01',to:'2026-11-30'}));
 assert.notEqual(financePeriodKey('a',{from:'x',to:'y'}),financePeriodKey('b',{from:'x',to:'y'}));
});
test('Discount amount preserves cents, uses subtotal for percentages and rejects invalid totals',()=>{
 const order={valor_total:24,valor_desconto:0,valor_subtotal:20};assert.equal(discountAmount('2,50','valor',order),2.5);assert.equal(discountAmount('10','percentual',order),2);
 for(const [value,type] of [['-1','valor'],['abc','valor'],['25','valor'],['101','percentual'],['','valor']])assert.throws(()=>discountAmount(value,type,order));
 assert.equal(discountAmount('0','valor',{valor_total:20,valor_desconto:4}),0);
});
test('Review tokens are copied only into the first-party review URL',()=>{
 assert.equal(reviewUrl('a'.repeat(43)),'https://wedelivery.site/avaliar/'+'a'.repeat(43));for(const token of ['http://evil','../x','x',null])assert.throws(()=>reviewUrl(token));
});
