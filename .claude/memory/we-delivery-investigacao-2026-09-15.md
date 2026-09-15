---
name: we-delivery-investigacao-2026-09-15
description: Análise profunda do desaparecimento de funcionalidades entre 14/09 e 15/09 — produção swap entre branches
metadata:
  type: project
---

# Investigação 2026-09-15: funcionalidades que "sumiram"

## Conclusão central
O domínio `wedelivery.site` aponta para o último deploy de **produção**. Em **14/09** o último deploy em produção era da branch `feat/correcoes-pedidos-mesa` (commit `cd16e35` "chore: remove componentes quebrados (serão refeitos corretamente)"). Em **15/09 às 10:56 UTC-3** um novo deploy da branch `main` (`a8c4d51` "fix(mesa): liberar atendente") sobrescreveu o alias de produção.

## O que Rick viu ontem vs o que está em produção hoje

### Botão "Sou funcionário" na landing
- **Visto ontem**: sim, num preview deploy com `gitDirty: "1"`
- **Estado real**: NUNCA foi commitado em nenhum branch. Existe APENAS na working tree local (não aparece em `git log` de `landing-client.tsx` para nenhum branch — o único commit é `f1078ec`)
- **Por que apareceu no preview da Vercel**: deploys com `gitDirty: "1"` constroem usando HEAD + working tree não-commitado. Ontem a working tree tinha a mudança; hoje não tem.
- **Hoje em produção**: botão NÃO existe na landing page (`src/app/landing-client.tsx`)
- **Memória da sessão da tarde 14/09 documenta isso** mas o arquivo não foi commitado

### Aba Mesas em /configuracoes
- **Visto ontem**: sim, no deploy da `feat/correcoes-pedidos-mesa` (`cd16e35`)
- **Estado real**: A `MesasTab` está commitada em `feat/correcoes-pedidos-mesa` mas NÃO está em `main`
- **Hoje em produção**: aba Mesas NÃO aparece em `/configuracoes` porque produção roda código da `main`

### Cadastro de mesas
- Página `src/app/(dashboard)/mesas/page.tsx` EXISTE desde o primeiro commit (`f1078ec`)
- API `src/app/api/mesas/route.ts` também
- **MAS não há link para ela no menu lateral** do dashboard
- Rick provavelmente descobriu a rota ontem digitando `/dashboard/mesas` direto, achou que estava em "Configurações" e ficou confuso

### Link "Copiar link de acesso" em /equipe
- Cards mostram 3 perfis: `attendant`, `cozinha`, `motoboy`
- Botão copia `${base}/acesso?perfil=${perfil}` (ex: `/acesso?perfil=cozinha`)
- **BUG**: `/acesso/page.tsx` NÃO usa o query param `?perfil=`. Mostra form genérico "Acesso ao Atendimento" e tenta login como ATENDENTE via `/api/auth/atendente-login`. Cozinha/Motoboy são rejeitados com "Este perfil não tem acesso a esta área"
- Rick precisa logar via `/acesso/cozinha` ou `/acesso/motoboy` diretamente, ou clicar no card certo

### Modal de equipe sem email
- Mudanças da tarde de 14/09 (modal com Nome+Username+Senha, refatoração de `/api/usuarios-loja`, nova `/api/equipe/login`) ESTÃO commitadas em `feat/correcoes-pedidos-mesa` (`cd16e35` + anteriores)
- Em produção hoje: modal em `/equipe` é o da `main`, que é o código antigo (com email obrigatório). Rick tem razão que essa funcionalidade "sumiu" também.

## Cronologia exata dos deploys (UTC-3 / Buenos Aires)
```
14/09 11:11–16:17  feat/correcoes-pedidos-mesa  (14 deploys, vários READY)
                  commits: 0958759 → cd16e35
                  ESTE FOI O QUE RICK VIU ONTEM

15/09 10:56–11:05  main                          (3 deploys)
                  commit: a8c4d51
                  ESTE É O QUE ESTÁ EM PRODUÇÃO AGORA (wedelivery.site)
```

## O que precisa ser feito para reabilitar as funcionalidades

### Opção A: merge da feat/correcoes-pedidos-mesa na main
- Traria: aba Mesas em /configuracoes, modal sem email, novos fluxos de login de equipe
- NÃO traria: botão "Sou funcionário" (precisa ser adicionado manualmente)
- Perigo: a branch está com `cd16e35` "remove componentes quebrados" — significa que ela já está instável

### Opção B: cherry-pick dos commits específicos
- Pegar `a583bfd` (MesasTab em configuracoes), commits da modal sem email, commits da API `/api/equipe/login`
- Aplicar diretamente na `main`
- Adicionar manualmente o botão "Sou funcionário"

### Opção C: re-criar tudo a partir do zero com cuidado
- Reimplementar na `main` (que é o branch atual em produção) sem depender da branch instável
- Mais demorado mas mais seguro

## Lição sobre working tree não-commitado
**Por que isso aconteceu**: Vercel faz deploys com `gitDirty: "1"` que incluem working tree não-commitado. Rick testou num preview, viu funcionar, MAS NÃO COMMITOU. No fim do dia, ao fazer outros commits, o `git status` mostrou mudanças não-commitadas que não foram incluídas nos commits subsequentes. Resultado: a funcionalidade "existiu" no preview por horas mas nunca no histórico do git.

**Como evitar no futuro**:
- Antes de testar num preview da Vercel, fazer commit (mesmo que com mensagem "wip")
- Sempre que a Vercel mostrar `gitDirty: "1"`, desconfiar — significa que há mudanças fora do git
- Ao "salvar o progresso", SEMPRE confirmar com `git log --all -- <arquivo>` que o arquivo está no histórico

**Why:** Documentar a investigação para evitar repetir o mesmo problema e dar contexto à próxima decisão de merge/recovery.
**How to apply:** Antes de propor mudanças, considerar que a `main` em produção é "limpa" e que a `feat/correcoes-pedidos-mesa` tem mudanças que precisam ser revalidadas antes de mergear. Nunca confiar que working tree = produção.
