# Checkpoint — Cardápio e operação — 2026-08-12

## Resultado

A rodada foi integrada e publicada no deploy `dpl_3iG8ciu6Kr8KC4871NsLWSuW8z2C`, associado a `https://wedelivery.site`. As migrations `043` a `046` foram aplicadas. O build final gerou 88 páginas e o smoke público respondeu HTTP 200. Nenhuma credencial ou dado pessoal é registrado aqui.

## Cardápio, identidade e comunicação

- O layout existente foi preservado e nomeado **Classic**.
- A identidade usa seis cores HEX: principal, secundária, destaque, fundo, textos e botões, com picker, validação, preview imediato e persistência compatível com configurações antigas.
- Tokens CSS aplicam o tema ao cardápio e overlays: cabeçalho, banner, badges, sessões, cards, preços, botões, carrinho, checkout, confirmação e rodapé.
- Tipografia é independente do layout: Clássica (Playfair Display/Lato), Moderna (Poppins/Inter) e Minimalista (Montserrat).
- Logo, banner principal e imagens de complementos possuem upload próprio.
- A comunicação inclui faixa secundária após as ações da loja e faixa superior com múltiplos textos. Modos: estático, contínuo, onda, piscar, digitação, fade e slide alternado. Links são HTTP/HTTPS e redução de movimento mantém o conteúdo legível.
- Produtos são agrupados por **Sessão**; atalhos usam os mesmos IDs dos destinos.
- Moderno e Minimalista continuam como layouts futuros sem quebrar o Classic.

## Compra, cliente e histórico

- O fluxo percorre listas de complementos na ordem definida, respeitando mínimos, máximos, obrigatoriedade, quantidades e acréscimos; depois exibe observação e a decisão de adicionar produto ou finalizar.
- Checkout coleta nome, telefone, aniversário, CPF opcional, entrega/retirada, endereço aplicável, pagamento habilitado e troco. Máscaras e validações foram alinhadas entre cliente e servidor.
- Voltar preserva estado; progresso segue etapas reais; o modal ganhou semântica de diálogo, Escape, controle e restauração básica de foco.
- O tema cobre todas as etapas, mantendo cores semânticas apenas para erro, sucesso e WhatsApp.
- Resumo e mensagem do WhatsApp incluem produtos, complementos, quantidades, valores, recebimento, cliente e pagamento.
- Histórico público usa token derivado e acesso protegido; perfil do cliente incorpora CPF sem consulta pública direta.

## Operação do lojista

- Financeiro, Gestão, Marketing e Equipe foram conectados ao tenant ativo e a dados reais.
- Perfil permite atualizar identidade e slug com unicidade case-insensitive.
- Multi-loja usa vínculo ativo em `usuarios_loja`, sem assumir que `auth.uid()` é o tenant.
- Entregas suportam bairros ativos, taxa/prazo, retirada e cálculo por distância/mapa quando configurado.
- Motoboys, avaliações, embaixadores e sorteios permanecem integrados às Sprints 5 e 6.

## Atomicidade, convites e segurança

- Cliente, pedido, itens, cupom e baixas de estoque de produto, complemento e insumo são processados na mesma transação.
- Idempotência e índice parcial protegem contra pedidos repetidos e concorrência.
- Convites guardam hash do token, expiram, conferem o e-mail autenticado e criam membership somente no aceite.
- A 044 prepara papéis/vínculos, valida dados e remove a policy pública antiga de áreas de entrega, evitando combinação permissiva por OR.
- A 045 remove a policy de acesso total a pedidos, revoga acesso anônimo em `pedidos`/`pedido_itens` e limita o dashboard a membros ativos do tenant.
- A 046 consolida o hardening de policies e privilégios.

## Validação e publicação

- TypeScript (`npx tsc --noEmit`): aprovado.
- Build Next.js: aprovado, 88/88 páginas.
- Supabase: migrations `043`–`046` aplicadas e verificadas.
- Vercel: deploy `dpl_3iG8ciu6Kr8KC4871NsLWSuW8z2C` no alias `https://wedelivery.site`.
- Smoke público: HTTP 200.

## Decisões e aprendizados

- Policies permissivas do PostgreSQL são combinadas por OR: uma policy antiga aberta deve ser removida, não apenas acompanhada por outra restritiva.
- Grants e RLS precisam ser auditados juntos. Pedido público entra pela API server-side/service role, nunca por CRUD anônimo direto.
- Ordem de banco: 044 prepara memberships/papéis e entregas; 045 depende dela para convites/pedido atômico; 046 fecha o hardening.
- Fallbacks preservam configurações visuais antigas ao adotar os seis tokens.
- Integrações externas ausentes devem falhar de forma explícita e controlada, sem produzir estimativas silenciosamente incorretas.

## Pendências conhecidas

- `MAPBOX_ACCESS_TOKEN` ausente: cálculo por km fica indisponível com tratamento controlado.
- `RESEND_API_KEY` é necessária para convite de conta existente quando esse fluxo não for atendido pelo provedor de autenticação; seu valor não deve ser documentado.
- Criar painéis e matriz de permissões específicos para Cozinha e Motoboy.
- Restringir transições de status do pedido em RPC validada.
- Definir retenção e limpeza da tabela `rate_limits`.
- Evoluir recuperação segura de histórico entre dispositivos.
- Construir os layouts Moderno e Minimalista.
- Resolver warnings do Next.js sobre `middleware` e `Cache-Control` customizado.
- Executar E2E visual e funcional real em desktop/mobile: tema, complementos, entrega/retirada, pagamento, estoque concorrente, cupom, WhatsApp, convite e multi-loja.
