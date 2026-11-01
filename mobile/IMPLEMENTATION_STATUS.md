# Android: estado real de implementação

## 0.3.0 — ampliação da área do lojista

As notas antigas abaixo descrevem versões anteriores. A versão 0.3.0 acrescenta:

- Pedido manual nativo com cliente, modalidade, endereço, itens, complementos, divisão de sabores, taxa, desconto, acréscimo e pagamento. Reaproveita a API transacional existente; um envio sem confirmação bloqueia reenvio automático.
- Edição completa da composição do pedido, preservando valores históricos de composições inalteradas e as validações do servidor.
- Sessões de mesas: abertura, cliente/observações, inclusão de pedidos, fechamento, cancelamento, reabertura, histórico e impressão de resumo.
- Relatórios por período, produtos, complementos, pagamento e melhores dias; filtros, ticket médio, visitas e compartilhamento em CSV textual.
- Marketing: clientes e histórico, top 10/aniversariantes, fidelidade, cashback, pontos por produto, carrinhos com atualização em tempo real, recuperação manual via WhatsApp, cupons e avaliações com resposta/moderação/filtros.
- Horários semanais/exceções, bairros/taxas, entrega por km, regra de estoque, capacidade por turno e tempos de pico.
- Cadastro e alteração de senha de equipe pela API existente; consultas nunca incluem senha. O backend legado ainda precisa de migração de hash compatível com o login operacional.
- Perfil privado por RPC restrita ao proprietário/gerente, sem liberar CPF/e-mail a todos os usuários autenticados.

Segurança: migrações já aplicadas no Supabase foram recuperadas com seus nomes/versões reais e incluídas em `migrations/`. Mesas e dias de pico passaram a ter isolamento por loja. Não foi publicado um novo serviço privilegiado nem alterado o layout/site em produção. Nenhum pedido real foi modificado nos testes.

**Ainda não concluído:** push com app minimizado/encerrado depende de Firebase/FCM não configurado. Alertas atuais são em primeiro plano. A área nativa de funcionário, administrador e o cardápio público não fazem parte desta ampliação da área do lojista. Assinatura continua de teste. Não afirmar paridade integral nem teste em aparelho antes da validação do lojista.

Validação da recuperação: TypeScript passou e 53 testes passaram, incluindo cookies pelo leitor SSR oficial, restrição de destinos, bloqueio de reenvio automático, valores de pedidos/relatórios e SQL real com duas lojas/usuário inativo/anon. Compilação APK e validação binária em andamento.

Diagnóstico de lentidão: [PERFORMANCE_FINDINGS.md](PERFORMANCE_FINDINGS.md). As otimizações não foram aplicadas.

O pedido é levar todas as funcionalidades do site ao aplicativo nativo. Esta branch continua **em construção** e não representa paridade completa nem uma versão pronta para operação.

## Implementado no código

- Autenticação Supabase, senha e fluxo Google PKCE, sessão criptografada e seleção explícita de loja.
- Navegação nativa: Início, Pedidos, Cardápio, Financeiro e Mais.
- Consulta paginada de pedidos, seis etapas, produtos/complementos e informações de pagamento, endereço e observações.
- Ações de aceitar/avançar/rejeitar/cancelar, edição de dados do cliente e endereço, impressão Android. Usam o JWT do usuário e as políticas RLS existentes, sem nova publicação do site.
- Alerta em primeiro plano: primeira consulta silenciosa; novas chegadas disparam áudio em loop; mudanças de etapa encerram os alertas correspondentes. Ainda exige teste em aparelho.
- Produtos: formulário em tela cheia com todos os grupos de campos do editor web, opções de listas de complementos e receitas, validação de sabores, ativar/desativar e seleção de foto. Upload usa o Storage com JWT e as políticas RLS existentes.
- Cadastros nativos: clientes, insumos, cupons, seções, listas e complementos. Formulários com validação e operações vinculadas à loja.
- Financeiro: leitura de movimentações e despesas, lançamento manual. Usa o acesso autenticado às tabelas existentes.
- Operações nativas usam exclusivamente Supabase Auth + RLS já existentes. As mudanças experimentais de autenticação das APIs web foram retiradas desta entrega; nenhum deploy no site é necessário.

## Pendente para paridade solicitada

- Novo pedido manual, edição completa de composição e complementos, descontos, WhatsApp e demais ações do desktop. Pagamento idempotente e atômico foi adicionado com a função 095; faltam testes em aparelho.
- Fluxo e sessões de mesas, configurações de horários/entrega/capacidade/estoque. Perfil e design (incluindo logo, três banners e faixas) já foram portados; aguardam validação real.
- Acessos operacionais, relatórios completos, marketing (fidelidade/disparos/recuperação), avaliações, embaixadores e sorteios. Cadastros de equipe e abertura/consulta de suporte já foram portados; aguardam validação real.
- Demais ações do cardápio: duplicação, reordenação, exclusão de produtos, clonagem de listas, imagens dos complementos e organização por listas no mobile.
- Cadastro de loja e aprovação; áreas pública e de administrador, se incluídas no escopo final do aplicativo.
- Push Android em segundo plano, configuração/credenciais FCM e teste de áudio com o app minimizado/encerrado.
- Incluir `wedelivery://auth/callback` nas Redirect URLs do Supabase antes de testar Google no APK. O conector atual não oferece edição de Auth config.
- Validação em emulador/aparelho e assinatura definitiva para distribuição pública permanecem pendentes. A compilação interna é ARM64, Android 7+.

## Evidências locais

- TypeScript do app passou.
- 41 testes mobile passaram, incluindo SQL real em banco local isolado: pagamento/caixa, repetição sem duplicidade, rollback e negação de acesso.
- Exportação Android/Hermes passou (bundle nativo, não APK).
- Backend: TypeScript e build Next passaram; 69 testes passaram e 2 de DPAPI foram pulados no Linux. Fixtures de pedido manual foram atualizadas para simular o import de autenticação de funcionário existente em main.
- Operações nativas foram testadas para vínculo da loja, escopo das escritas, campos permitidos e ausência de senhas em consultas de equipe.
- Duas compilações Gradle/APK concluídas; assinatura v2 verificada. Compilação final 0.2.0 em preparação. Android 7+ (API 24), ARM64; nenhuma validação em aparelho/emulador foi realizada.

A migração 095 (nova função de pagamento nativo) foi aplicada em produção e suas ACLs verificadas. Nenhum pedido real foi alterado nos testes. A versão de produção do site permanece no deployment dpl_8N8fLNQ2Q43qgU3ghQqm8WY9bhxt e respondeu HTTP 200. Uma proposta de API separada foi rejeitada pela revisão automática e não foi publicada. O APK usa uma alternativa sem chave privilegiada e sem novo serviço HTTP. Não incluir tokens privados, senhas, service role, keystore ou arquivos de ambiente em commits/artefatos.

A revisão automática rejeitou a publicação de uma Edge Function por exposição adicional com service_role/verify_jwt:false/CORS aberto. Não houve nova tentativa dessa publicação nem alteração das permissões para contornar o bloqueio. Cadastro/reset de senha da equipe, composição de pedidos e outros recursos ainda não portados não estão disponíveis nesta prévia.

## Correção de compatibilidade 0.2.1

O APK 0.2.0 foi empacotado somente para arm64-v8a. O usuário reportou rejeição de instalação em um Galaxy A03 Core SM-A032M/DS com Android 13. As fotos não confirmam a lista de ABIs do sistema; incompatibilidade de arquitetura é a hipótese principal. A versão 0.2.1 acrescenta armeabi-v7a e preserva arm64-v8a, com versionCode 3. O perfil EAS preview fixa as duas arquiteturas, e scripts/verify-apk-abis.py confere o cabeçalho ELF de todas as bibliotecas de ambas. A instalação no aparelho permanece sujeita ao novo teste do usuário. Nenhuma alteração ou deploy do site é necessário.

## 0.2.2 — mobile website presentation parity (2026-10-31)

- Native presentation now uses the website's Inter family (embedded 400/600/700/800), Lucide icons, exact mobile navigation measurements and colors from `merchant.css`. The five labels fit on one line; no Unicode substitutes.
- Merchant header only on Início; logout in Mais. Home uses the same sales card, kitchen queue, monthly disclosure, store hours/override logic, and menu link sheet. No website deployment or database ACL change in this release.
- Pedidos includes Fluxo/Histórico/Mesas, single calendar range control, stage dropdown, full card details and existing editing/actions. Manual order creation remains explicitly unavailable, with an explanation rather than a fake submission. Mesas currently manages registered tables; it does not reproduce live table sessions yet.
- Cardápio now includes Produtos/Design/Complementos, named group disclosures and floating product cards, native full-screen editor, status/duplicate/remove/reorder controls. Complement editing still opens the general editor/list rather than deep-linking a selected record.
- Financeiro exposes received/unpaid/balance summaries and three tabs, preserving the existing native authenticated transport. Mais follows the website's eight primary destinations, with existing native screens grouped underneath. Relatórios currently provides financial summary only; full website report parity remains pending.
- This is a native Android test build, not a WebView. Pixel equivalence across Android/iOS/browser font engines is not assumed. Device verification remains with the tester; structural layout checks do not substitute for device testing.

Validation for 0.2.2: TypeScript passed; 45 tests passed (including real local PostgreSQL payment rollback/isolation checks). The five React Native screens were additionally rendered with synthetic data through react-native-web at 320, 360 and 390 px: 15 combinations passed navigation pinning, five single-line labels and no horizontal page overflow. This browser-based layout check is not an Android device test. The website reference CSS was verified against main, Git blob `341c296d92d46c2d53f0f55eb418369400fa76ca`.
