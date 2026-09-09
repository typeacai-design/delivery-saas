# Acesso local às APIs de infraestrutura

Os scripts que usam `scripts/lib/supabase-management.js` aceitam primeiro
`SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF` do ambiente.

Sem essas variáveis, o loader busca `.credentials/supabase.json` na raiz
do repositório principal. Neste computador, o caminho é
`C:\Users\ranie\delivery-saas\.credentials\supabase.json`.
Worktrees encontram a mesma raiz pelo `git rev-parse --git-common-dir`,
sem duplicar o token. Para uma localização explícita, defina
`WE_DELIVERY_CREDENTIALS_PROJECT` com o caminho absoluto do projeto.
O diretório antigo `%LOCALAPPDATA%\WeDelivery\credentials\supabase.json`
continua disponível somente como fallback de leitura.

A pasta `.credentials` é ignorada pelo Git e pela Vercel.
O token é cifrado com Windows DPAPI CurrentUser: somente o mesmo usuário
Windows consegue decifrá-lo nesta instalação. O loader mantém o segredo
em memória; não o imprime nem grava em .env. Copiar o arquivo para outro
usuário/computador não transfere o acesso. Em outros sistemas, use
variáveis de ambiente.

Projeto We Delivery: `iqacuakyyzhrsrjzlnai`.

Para cadastrar ou renovar, envie via stdin ao processo
`node scripts/store-supabase-credentials.js` um objeto JSON com
`accessToken` e `projectRef`. Passe esse conteúdo diretamente em memória
a partir da ferramenta autorizada; não coloque o token em argumentos,
histórico do shell, arquivos temporários, mensagens ou commits. O helper
retorna apenas caminho, projeto e confirmação. A substituição é atômica;
o arquivo temporário contém somente material já cifrado.

Exemplo de diagnóstico sem alteração de dados:
`node -e "require('./scripts/lib/supabase-management').query('select 1 as ok').then(console.log)"`.

A presença de credenciais não autoriza migrações ou deploys por si só.
Use o escopo autorizado na tarefa. Revogue o PAT no Supabase se necessário
e cadastre outro pelo mesmo helper.

A Vercel já mantém autenticação no cache oficial da CLI, normalmente
`%APPDATA%\com.vercel.cli\Data\auth.json` ou
`%APPDATA%\xdg.data\com.vercel.cli\auth.json`. Prefira reutilizar a CLI
autenticada ou ler esse cache somente em memória para chamadas autorizadas.
Não copie esse token para o repositório. A validade deve ser confirmada
por uma consulta somente de leitura antes do uso.
