# Android: estado real de implementação

O pedido é levar todas as funcionalidades do site ao aplicativo nativo. Esta branch continua **em construção** e não representa paridade completa nem uma versão pronta para operação.

## Implementado no código

- Autenticação Supabase, senha e fluxo Google PKCE, sessão criptografada e seleção explícita de loja.
- Navegação nativa: Início, Pedidos, Cardápio, Financeiro e Mais.
- Consulta paginada de pedidos, seis etapas, produtos/complementos e informações de pagamento, endereço e observações.
- Ações de aceitar/avançar/rejeitar/cancelar, edição de dados do cliente e endereço, impressão Android. Dependem da adaptação de autenticação das APIs desta branch, ainda não publicada.
- Alerta em primeiro plano: primeira consulta silenciosa; novas chegadas disparam áudio em loop; mudanças de etapa encerram os alertas correspondentes. Ainda exige teste em aparelho.
- Produtos: formulário em tela cheia com todos os grupos de campos do editor web, opções de listas de complementos e receitas, validação de sabores, ativar/desativar e seleção de foto. Upload depende da API autenticada.
- Cadastros nativos: clientes, insumos, cupons, seções, listas e complementos. Formulários com validação e operações vinculadas à loja.
- Financeiro: leitura de movimentações e despesas, lançamento manual. Depende da API autenticada.
- Backend: suporte a bearer request-scoped, isolamento de sessão web/nativa, seleção explícita de loja para chamadas nativas, guard compartilhado no status do pedido.

## Pendente para paridade solicitada

- Novo pedido manual, edição completa de composição e complementos, descontos, WhatsApp e demais ações do desktop. Pagamento idempotente e atômico foi adicionado com a função 095; faltam testes em aparelho.
- Fluxo e sessões de mesas, configurações de horários/entrega/capacidade/estoque. Perfil e design (incluindo logo, três banners e faixas) já foram portados; aguardam validação real.
- Acessos operacionais, relatórios completos, marketing (fidelidade/disparos/recuperação), avaliações, embaixadores e sorteios. Cadastros de equipe e abertura/consulta de suporte já foram portados; aguardam validação real.
- Demais ações do cardápio: duplicação, reordenação, exclusão de produtos, clonagem de listas, imagens dos complementos e organização por listas no mobile.
- Cadastro de loja e aprovação; áreas pública e de administrador, se incluídas no escopo final do aplicativo.
- Push Android em segundo plano, configuração/credenciais FCM e teste de áudio com o app minimizado/encerrado.
- Incluir `wedelivery://auth/callback` nas Redirect URLs do Supabase antes de testar Google no APK. O conector atual não oferece edição de Auth config.
- Publicação/testes do backend compatível; validação em emulador/aparelho e entrega do APK de teste. Assinatura definitiva para distribuição pública permanece pendente.

## Evidências locais

- TypeScript do app passou.
- 34 testes mobile passaram, incluindo SQL real em banco local isolado: pagamento/caixa, repetição sem duplicidade, rollback e negação de acesso.
- Exportação Android/Hermes passou (bundle nativo, não APK).
- Backend: TypeScript e build Next passaram; 69 testes passaram e 2 de DPAPI foram pulados no Linux. Fixtures de pedido manual foram atualizadas para simular o import de autenticação de funcionário existente em main.
- Sete testes adicionais de seleção/autorização e isolamento de cookies/bearer passaram.
- Duas compilações Gradle/APK concluídas; assinatura v2 verificada. Compilação final 0.2.0 em preparação. Android 7+ (API 24), ARM64; nenhuma validação em aparelho/emulador foi realizada.

A migração 095 (nova função de pagamento nativo) foi aplicada em produção e suas ACLs verificadas. Nenhum pedido real foi alterado nos testes. APIs web desta branch foram publicadas somente em prévia até este registro. Não incluir tokens privados, senhas, service role, keystore ou arquivos de ambiente em commits/artefatos.
