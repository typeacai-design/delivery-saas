import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteCache } from '../src/remote-cache.ts';
import { confirmOrder, confirmMutation } from '../src/order-cache.ts';
const tick = () => new Promise(resolve => setImmediate(resolve));
test('Returning to a fresh tab reuses data and concurrent readers share one request', async () => {
  const cache = new RemoteCache(); let calls=0, finish;
  const load=()=>{calls++;return new Promise(resolve=>{finish=resolve})};
  const a=cache.load('finance:a:summary',load),b=cache.load('finance:a:summary',load);
  await tick();assert.equal(calls,1);finish({received:24});await Promise.all([a,b]);
  await cache.load('finance:a:summary',load);assert.equal(calls,1);assert.equal(cache.snapshot('finance:a:summary').data.received,24);
});
test('Background errors retain previously loaded data, and retry clears the error',async()=>{
  const cache=new RemoteCache();await cache.load('a',async()=>({total:12}));
  await cache.load('a',async()=>{throw Error('offline')},true);assert.equal(cache.snapshot('a').data.total,12);assert.equal(cache.snapshot('a').error,'offline');
  await cache.load('a',async()=>({total:13}),true);assert.equal(cache.snapshot('a').error,'');assert.equal(cache.snapshot('a').data.total,13);
});
test('A stale response cannot undo a confirmed payment or status',async()=>{
  const cache=new RemoteCache();await cache.load('a',async()=>({paid:false}));let finish;
  const old=cache.load('a',()=>new Promise(resolve=>{finish=resolve}),true);await tick();cache.patch('a',()=>({paid:true}));finish({paid:false});await old;assert.equal(cache.snapshot('a').data.paid,true);
});
test('Invalidation during a request discards it and the next load is authoritative',async()=>{
  const cache=new RemoteCache();let finish;const old=cache.load('a',()=>new Promise(resolve=>{finish=resolve}));await tick();cache.invalidate('a');await cache.load('a',async()=>({value:2}));finish({value:1});await old;assert.equal(cache.snapshot('a').data.value,2);
});
test('Store and session caches are isolated and clear aborts outstanding work',async()=>{
  const a=new RemoteCache(),b=new RemoteCache();await a.load('orders:store-a:',async()=>({secret:1}));assert.equal(a.snapshot('orders:store-b:').data,null);assert.equal(b.snapshot('orders:store-a:').data,null);
  let signal;await a.load('other',async s=>{signal=s;return 1});a.clear();assert.equal(a.snapshot('orders:store-a:').data,null);
});
const original={id:'a',status:'novo',data_criacao:'2026-11-01T13:00:00Z',pago:false};
function list(orders,stage='novo',count=orders.length){return {orders,count,filter:{stage,page:0,from:'2026-11-01T03:00:00Z',until:'2026-11-02T03:00:00Z'}}}
test('Confirmed payment updates only that order; stage change adjusts lists and counts after confirmation',async()=>{
  const cache=new RemoteCache(),other={...original,id:'b'};await cache.load('orders:store:novo',async()=>list([original,other]));await cache.load('orders:store:preparando',async()=>list([],'preparando'));await cache.load('orders:foreign:novo',async()=>list([original]));
  confirmOrder(cache,'store',{...original,pago:true},original);let d=cache.snapshot('orders:store:novo').data;assert.equal(d.count,2);assert.equal(d.orders.find(x=>x.id==='a').pago,true);assert.equal(d.orders.find(x=>x.id==='b').pago,false);
  confirmOrder(cache,'store',{...original,status:'preparando',pago:true},{...original,pago:true});d=cache.snapshot('orders:store:novo').data;assert.equal(d.count,1);assert.deepEqual(d.orders.map(x=>x.id),['b']);assert.equal(cache.snapshot('orders:store:preparando').data.count,1);assert.equal(cache.snapshot('orders:foreign:novo').data.orders[0].status,'novo');
});
test('External changes unknown to a cached page invalidate its count instead of inventing it',async()=>{
  const cache=new RemoteCache();await cache.load('orders:store:novo',async()=>list([], 'novo',99));confirmOrder(cache,'store',original);assert.equal(cache.snapshot('orders:store:novo').revision,1);assert.equal(cache.snapshot('orders:store:novo').data.count,99);
});

test('A confirmed status does not overwrite a newer payment from another event',async()=>{
  const cache=new RemoteCache();await cache.load('orders:store:novo',async()=>list([{...original,pago:true}]));
  const before=cache.generation('order-event:store:a');
  confirmMutation(cache,'store',original,{status:'preparando'});
  assert.ok(cache.generation('order-event:store:a')>before);
  await cache.load('orders:store:all',async()=>list([{...original,pago:true}],'todos'));
  confirmMutation(cache,'store',original,{status:'preparando'});
  assert.equal(cache.snapshot('orders:store:all').data.orders[0].pago,true);
});
