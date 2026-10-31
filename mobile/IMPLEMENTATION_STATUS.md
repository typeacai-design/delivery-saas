# Android: estado real de implementação

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
