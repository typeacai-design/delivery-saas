// Script que gera src/data/cidades/[UF].ts para os 26 estados restantes
// Usa a API oficial do IBGE: https://servicodados.ibge.gov.br
const https = require('https')
const fs = require('fs')
const path = require('path')

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

function fetchUF(uf) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'servicodados.ibge.gov.br',
      path: `/api/v1/localidades/estados/${uf}/municipios`,
      method: 'GET',
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try { resolve(JSON.parse(d)) } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

async function main() {
  const outDir = path.join(__dirname, '..', 'src', 'data', 'cidades')
  fs.mkdirSync(outDir, { recursive: true })

  for (const uf of UFS) {
    process.stdout.write(`${uf}... `)
    try {
      const cidades = await fetchUF(uf)
      const nomes = cidades.map(c => c.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))
      const content = `export const CIDADES = ${JSON.stringify(nomes, null, 2)}\n`
      fs.writeFileSync(path.join(outDir, `${uf}.ts`), content)
      console.log(`${nomes.length} cidades`)
    } catch (e) {
      console.error(`ERRO em ${uf}:`, e.message)
    }
  }
  console.log('✓ Pronto')
}

main().catch(e => { console.error(e); process.exit(1) })
