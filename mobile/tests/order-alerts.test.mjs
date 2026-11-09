import test from 'node:test'
import assert from 'node:assert/strict'
import {OrderAlertTracker} from '../src/order-alert-tracker.ts'
const o=(id,status='novo')=>({id,status,data_criacao:new Date(2000).toISOString()})
test('Entering and refreshing stay silent; genuinely new arrivals keep sounding until resolved',()=>{const t=new OrderAlertTracker(1000);t.snapshot([o('old')]);assert.equal(t.pending.size,0);t.snapshot([o('old')]);assert.equal(t.pending.size,0);t.receive(o('new'));t.receive(o('another'));assert.equal(t.pending.size,2);t.receive(o('new','preparando'));assert.deepEqual([...t.pending],['another']);t.receive(o('another','cancelado'));assert.equal(t.pending.size,0)})
test('Pagination absence does not silently acknowledge an unresolved arrival',()=>{const t=new OrderAlertTracker(1000);t.snapshot([]);t.receive(o('new'));t.snapshot([]);assert.equal(t.pending.has('new'),true);t.remove('new');assert.equal(t.pending.size,0)})
