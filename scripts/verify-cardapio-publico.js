const fs = require('fs')

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=')
      return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, '')]
    })
)

async function run() {
  const productsResponse = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/produtos?select=nome&tenant_id=eq.1396a259-0217-4d26-b819-fd8a15d18dea&ativo=eq.true`,
    {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    }
  )
  if (!productsResponse.ok) throw new Error(await productsResponse.text())
  const products = await productsResponse.json()

  const requestedUrl = `https://wedelivery.site/cardapio/typeacai?verify=${Date.now()}`
  const redirectResponse = await fetch(requestedUrl, { redirect: 'manual' })
  const pageResponse = await fetch(requestedUrl)
  const html = await pageResponse.text()
  if (!pageResponse.ok) throw new Error(`Cardapio HTTP ${pageResponse.status}`)

  const missing = products.filter((product) => !html.includes(product.nome))
  console.log(JSON.stringify({
    status: pageResponse.status,
    redirectStatus: redirectResponse.status,
    redirectLocation: redirectResponse.headers.get('location'),
    finalUrl: pageResponse.url,
    htmlLength: html.length,
    title: html.match(/<title>(.*?)<\/title>/)?.[1] || null,
    matchedPath: pageResponse.headers.get('x-matched-path'),
    vercelCache: pageResponse.headers.get('x-vercel-cache'),
    contemTenant: html.includes('TYPE ACAI') || html.includes('TYPE AÇAÍ'),
    contemNaoEncontrado: html.includes('This page could not be found'),
    produtosPublicos: products.length,
    produtosRenderizados: products.length - missing.length,
    ausentes: missing.map((product) => product.nome),
  }))
  if (missing.length) process.exit(1)
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
