# Login Google — ativação

Código preparado com o recurso desligado até a configuração do provedor.

1. Acesse https://console.cloud.google.com/auth/overview com a conta do projeto.
2. Crie ou selecione o projeto We Delivery. Configure marca, suporte e público externo no Google Auth Platform. Use apenas os escopos de identificação (openid, email, profile).
3. Em Clientes, crie um cliente OAuth do tipo Aplicativo da Web.
   - Origem autorizada: https://wedelivery.site
   - URI de redirecionamento: https://iqacuakyyzhrsrjzlnai.supabase.co/auth/v1/callback
4. Abra https://supabase.com/dashboard/project/iqacuakyyzhrsrjzlnai/auth/providers
   Habilite Google e informe o Client ID e Client Secret diretamente no painel. Não salve segredos no GitHub ou envie em conversas.
5. Em https://supabase.com/dashboard/project/iqacuakyyzhrsrjzlnai/auth/url-configuration
   - Site URL: https://wedelivery.site
   - Redirect URL permitida: https://wedelivery.site/auth/callback
   Para homologação, adicione apenas a URL exata do preview; não use curingas para qualquer domínio.
6. Enquanto o projeto Google estiver em teste, inclua os e-mails dos testadores na seção Público. Depois de homologar, publique o público do OAuth para permitir outros lojistas, cumprindo os requisitos exibidos pelo Google.
7. Na Vercel, configure NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true somente no ambiente que já estiver configurado e faça novo build. Para desativar, remova ou altere para false e reconstrua.
8. Homologue: conta nova preenche loja e aguarda aprovação; conta existente mantém mesmo user_id/loja; conta suspensa não entra; cancelamento mostra erro amigável; retorno inválido não aceita sessão; senha continua funcionando. Confirme o vínculo automático de identidades do Supabase com o mesmo e-mail verificado em uma conta de teste antes de liberar contas existentes.

Fluxo: /auth/google → Google/Supabase → /auth/callback → loja existente ou /registro?google=1. Sessão PKCE tratada por @supabase/ssr; callback usa caminhos internos fixos e não aceita next externo. Nenhum acesso de administrador SaaS é concedido pelo login Google.

Novo cadastro usa getUser no servidor, identidade Google e e-mail verificado. O e-mail/user_id enviado pelo formulário não concede acesso. Loja permanece pending_approval, com as regras atuais de indicação. Membros existentes, mesmo inativos, não são recriados pelo cadastro. Contas Google já existentes nunca são excluídas pela limpeza de falha de cadastro.

O aplicativo Android futuro exigirá clientes OAuth/deep links próprios; esta entrega é para o site. Nenhum Client Secret deve entrar no APK.

Validação automatizada: pnpm test:google (Node 22.13+). Os 19 testes com adaptadores isolados passaram com Node 24; ainda faltam build completo e homologação real do OAuth.


Limites: o cadastro existente faz gravações compensadas, não uma transação única. O ID determinístico da loja impede duas lojas por duplo envio Google; em caso de falha na limpeza será necessário suporte. Não foi alterada a autenticação legada de funcionários neste escopo.

