# Financeiro e histórico — 1 de novembro de 2026

## Escopo e regra permanente do projeto

Ajustes gerais de funcionalidade, inclusão/remoção e correções devem ser aplicados no web mobile e no aplicativo Android. O web é a referência visual: pedidos para igualar layout seguem web → aplicativo. Não inverter essa direção. Preservar o layout desktop, conforme a última instrução do usuário nesta sessão.

## Mudanças

- Histórico mobile: resumo recolhível por pedido com código, cliente, data/hora de São Paulo e etiqueta de etapa. Detalhes/ações aparecem ao expandir. Fluxo e layout desktop preservados.
- Financeiro mobile abre no mês corrente de São Paulo e usa o mesmo calendário de período do Histórico. O resumo e as listas filtram no servidor; listas limitadas a 50 registros.
- Contas a receber são cadastros manuais independentes de pedidos. Pedidos pagos continuam no caixa; pedidos pendentes também não viram contas manuais automaticamente. Contas manuais filtram por vencimento e só entram no caixa após confirmação de recebimento.
- Recebimento e entrada no caixa são uma transação: o trigger não repete a entrada e uma falha desfaz a confirmação. RLS e ACL por loja/perfil/loja ativa; inserção não pode forjar recebimento; alteração de valor e reversão não são concedidas ao cliente.
- Pedidos web: substituídas consultas sequenciais por pedido por lotes de 50 IDs com paginação de itens e rejeição de respostas antigas. Não foi medida latência no aparelho e não se afirma que todas as causas de lentidão foram eliminadas.
- APK Android 0.3.5, versionCode 10, mantém runtime nativo 0.3.3, pacote e assinatura de teste anteriores; bundle atualizado, bibliotecas ARM 32/64 bits verificadas.

## Validação

Web: build Next.js 16.3.0 com webpack e TypeScript aprovados; 73 testes aprovados e 2 testes existentes ignorados. Corrigida a fixture dos testes de sabores para contemplar o import de autenticação de funcionário já presente na rota, sem alteração dessa rota.
App: 84 testes de regressão anteriores e 4 novos testes de histórico/SQL aprovados; TypeScript aprovado.
Banco: migração manual_receivables aplicada a iqacuakyyzhrsrjzlnai; recebimento repetido verificado em transação com ROLLBACK, sem persistir conta ou movimentação de teste. Advisors sem achados novos referentes aos objetos criados.

## Operação

Código web baseado na main ca86f175466e6d855e6942845839a87d72db48cd. Não transferir o app para o projeto Supabase novo sem migração completa: o runtime atual ainda usa iqacuakyyzhrsrjzlnai.

## Autorização de publicação

Após o bloqueio inicial da revisão automática, o usuário autorizou explicitamente publicar estas alterações no repositório typeacai-design/delivery-saas e no site wedelivery.site. A autorização foi dada nesta conversa em 1 de novembro de 2026.
