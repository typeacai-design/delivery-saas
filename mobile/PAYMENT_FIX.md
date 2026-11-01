# Correção do pagamento mobile — 01/11/2026

Os logs registraram `permission denied for table pedidos` às 12:09 e 12:12 UTC. A função invoker 095 fazia SELECT * apesar de existirem colunas sem leitura para authenticated. Depois disso, a categoria `venda` era rejeitada pela constraint do financeiro, que permite `pedido`.

A migração limita o SELECT aos cinco campos necessários e usa a categoria `pedido`. Mantém a transação, trava de linha, idempotência, SECURITY INVOKER, verificações de vínculo/loja ativa/bloqueio e as mesmas ACLs/RLS. O trigger de total da mesa agora dispara somente nas inserções/exclusões e alterações de status, valor ou sessão; pagamentos não recalculam um total inalterado nem entram nas consultas legadas de sessão.

Seis testes SQL isolados reproduzem os dois erros originais e validam pagamento repetido sem duplicidade, estorno, rollback na falha do caixa, pedido de mesa e negação para outra loja/usuário inativo/loja bloqueada/anon. A inspeção dos catálogos após aplicar confirmou os campos/categoria corretos, invoker, anon sem EXECUTE e sem novos grants de leitura.

A revisão automática rejeitou um teste RPC sobre pedido real, mesmo proposto como repetição sem alteração e ROLLBACK, por risco de bloqueio/efeitos colaterais. Não foi executado nem repetido por outro caminho. A validação de mutações foi exclusivamente em PGlite isolado, e a conferência em produção limitou-se a logs, schema, constraints, políticas e definições. Falta o lojista confirmar o clique real no aplicativo. Não é necessário novo APK ou deploy do site.
