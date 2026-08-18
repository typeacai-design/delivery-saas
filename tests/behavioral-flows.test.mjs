import test from 'node:test'
import assert from 'node:assert/strict'
import { formatBirthdayInput, isValidBirthday, birthdayToIso } from '../src/lib/checkout-date.ts'
import { hashAccessToken, tokenMatches } from '../src/lib/customer-identity.ts'

test('máscara real de aniversário progride em 2, 4 e 8 dígitos',()=>{assert.equal(formatBirthdayInput('12'),'12');assert.equal(formatBirthdayInput('1208'),'12/08');assert.equal(formatBirthdayInput('12081990'),'12/08/1990');assert.equal(formatBirthdayInput('12a08-1990-extra'),'12/08/1990')})
test('conversão real rejeita vazio, data impossível e data futura em Fortaleza',()=>{const now=new Date('2026-08-13T02:00:00Z');assert.equal(birthdayToIso('12/08/1990',now),'1990-08-12');assert.equal(birthdayToIso('',now),null);assert.equal(birthdayToIso('29/02/2023',now),null);assert.equal(birthdayToIso('13/08/2026',now),null);assert.equal(isValidBirthday('12/08/2026',now),true);assert.equal(isValidBirthday('13/08/2026',now),false)})
test('token real do cliente exige segredo correspondente',()=>{const token='segredo-cliente-'.padEnd(32,'x'),hash=hashAccessToken(token);assert.equal(tokenMatches('',hash),false);assert.equal(tokenMatches('00000000-0000-0000-0000-000000000000',hash),false);assert.equal(tokenMatches(token,hash),true)})
