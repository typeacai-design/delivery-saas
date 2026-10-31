# We Delivery Android — primeira base nativa

Projeto React Native + Expo SDK 58, independente do Next.js. Esta é uma prévia de desenvolvimento e consulta, ainda não substitui o painel do lojista. Não usa WebView. O navegador do sistema é aberto exclusivamente para consentimento do Google e retorna para telas nativas via PKCE.

## Implementado nesta etapa

- Login por e-mail/senha e fluxo Google com PKCE; sessão criptografada no SecureStore, fragmentada para suportar sessões grandes.
- Associação às lojas do usuário autenticado pelo Supabase; seleção explícita quando há mais de uma. Somente lojistas/gerentes nesta fase. Lojas pendentes, suspensas ou bloqueadas não abrem o painel.
- Início com nome/logo e contagens exatas dos pedidos do dia. Não soma faturamento a partir de uma lista truncada.
- Consulta de pedidos, seis etapas, Hoje/Ontem, paginação de 25, produtos/complementos, pagamento, endereço, observações e total histórico.
- Consulta de produtos com seções recolhíveis e cartões separados. Paginação interna evita truncar o catálogo.
- Eventos Realtime de pedidos com filtro de loja, reconciliação a cada 30 segundos em primeiro plano e atualização ao retornar ao app. Não há áudio ou push nesta fase.
- Leituras autenticadas usam chave pública e as políticas RLS existentes. Não há chave administrativa nem API que aceite identidade de funcionário informada pelo cliente. Não foram alterados site, tabelas ou políticas.

## Preparar e verificar

Node 24 recomendado. `npm ci`, `npm run typecheck`, `npm test`, `npm run export:android`.

Copie `.env.example` para `.env.local` e preencha apenas a chave pública do Supabase (publishable). Nunca coloque service_role, Google Client Secret, senha ou token EAS nas variáveis EXPO_PUBLIC.

Antes de testar Google no APK, adicione **exatamente** `wedelivery://auth/callback` às Redirect URLs do projeto Supabase em uso. Preserve as URLs atuais do site. O cliente OAuth Web existente pode ser reutilizado neste fluxo pelo navegador; esta entrega não implementa o SDK nativo de identidade Google, que exigiria configuração Android própria. A interface do aplicativo é nativa.

O cadastro de novas lojas nesta prévia permanece no site. Não há criação automática de loja ao fazer login Google sem vínculo.

## Gerar o APK de teste

Ainda não foi gerado um APK nesta etapa. A exportação Metro/Hermes valida o código Android, mas não é um instalador nem um teste em aparelho.

Faltam conta/projeto Expo EAS sob o e-mail do projeto e credencial de assinatura Android. Não foi encontrado EXPO_TOKEN configurado nesta sessão, nem SDK Android local. Não foi criada assinatura em nome de outra conta nem iniciado build pago.

Depois de conectar a conta Expo: vincule este diretório com `eas init`, configure `EXPO_OWNER` e `EAS_PROJECT_ID` conforme o projeto criado e cadastre as variáveis públicas no ambiente EAS selecionado. Execute `eas build --platform android --profile preview`. O perfil preview gera APK para instalação direta. O perfil production gera AAB para Play Store.

Use o ambiente EAS indicado pelo serviço para cada perfil; não presuma que `.env.local` viajará no upload: os arquivos `.env*` estão excluídos. A compilação deve receber EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY pelos ambientes EAS. Depois do vínculo, registre o projectId real no app.config.ts/extra.eas; não invente IDs. Preserve a chave de assinatura na conta do projeto.

## Ainda falta para o aplicativo completo

1. Adaptar APIs de escrita para sessão mobile verificável e reaproveitar regras atômicas de preços, sabores, estoque, fidelidade e financeiro. Implementar aceitar/rejeitar/avançar, editar, desconto, pago, novo pedido e impressão.
2. Completar cardápio (editor, complementos, design), financeiro, clientes, estoque, equipe e demais funções da matriz original. As três abas atuais não representam o escopo final.
3. Revisar as falhas de autenticação legada da equipe e as tabelas sem isolamento identificadas no mapeamento. Elas não foram transportadas para este aplicativo.
4. Notificações Android/FCM, som apenas para novos pedidos, sincronização entre aparelhos e comportamento com tela bloqueada. Não prometer loop de som em segundo plano sem validação nativa.
5. Verificar visualmente em Android real: tamanhos, teclado, acessibilidade, fontes, identidade visual/ícones definitivos e listas longas. O visual segue a direção verde aprovada, mas ainda não passou por homologação em aparelho.
6. Homologar login/sessão/retorno Google, isolamento entre lojas, conta suspensa e reconexão com usuários de teste. Os testes automatizados usam adaptadores isolados; não utilizam contas pessoais ou clientes reais.

Referências: https://docs.expo.dev/build-reference/apk/ · https://supabase.com/docs/guides/auth/native-mobile-deep-linking · https://docs.expo.dev/versions/latest/sdk/securestore/
