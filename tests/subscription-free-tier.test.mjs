import test from 'node:test'
import assert from 'node:assert/strict'
import { mensalidadeCentavos } from '../src/lib/assinaturas.ts'

test('mensalidade gratuita até R$ 2.000 inclusive, faixas pagas preservadas', () => {
  for (const [revenue, fee] of [[0,0],[1,0],[199999,0],[200000,0],[200001,5000],[500000,5000],[500001,10000],[1000000,10000],[1000001,15000],[1500000,15000],[1500001,20000]]) {
    assert.equal(mensalidadeCentavos(revenue), fee, `faturamento ${revenue}`)
  }
})
