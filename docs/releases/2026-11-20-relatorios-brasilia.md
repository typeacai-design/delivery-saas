# Relatórios integrados e calendário Brasília — preparação 0.4.1

## Escopo

- Web desktop/mobile e Android usam o mesmo GET /api/relatorios, autenticado para owner/manager, sem receber tenant arbitrário e com consultas paginadas por loja.
- Nove relatórios, visualizações com quatro períodos, resumo, pagamentos sem forma e mistos, cancelamentos, consolidação de mesas.
- Excel XLSX com onze abas (resumo, nove relatórios e visualizações), valores numéricos, texto literal e filtros do mesmo snapshot da tela.
- Vendas por data de criação, mesas por fechamento, cancelamentos por cancelamento quando disponível; despesas pelo período integral, sem duplicar referência. Entradas adicionais não vinculadas a venda são separadas.
- Calendário civil central America/Sao_Paulo; timestamps absolutos continuam em UTC. Horário local de dispositivo não determina filtros, cupons, aniversários, fechamento, horários de funcionamento e exibição.
- Migração 20261120112545_brasilia_global_civil_dates.sql ajusta quatro rotinas e quatro defaults de data, preservando registros e permissões.

## Validação

- Dados reais Type Açaí 01–20/11: 91 pedidos pagos, R$ 2.331,00. PIX 47 / R$ 1.255; dinheiro 32 / R$ 771; crédito 1 / R$ 35; não informado 11 / R$ 270. Resultado do modelo conferido com SQL independente.
- Quatro testes específicos do modelo, calendário em fusos diferentes, filtros e pacote XLSX aprovados. Arquivo de validação aberto com openpyxl e 11 abas confirmadas.
- 88 testes nativos e TypeScript passaram. APK 0.4.1 versionCode 12 assinado com a chave da versão 0.4.0; ABI ARM 32/64, assinatura e zip verificados.
- O teste de migração em PostgreSQL local isolado confirmou TimeZone e expressão do default. Não houve alteração na produção.
- A suíte web possui três falhas preexistentes em contratos antigos de layout do editor de produtos/pedidos, não relacionadas a esta entrega. O trecho desktop do editor de pedidos tem o mesmo hash do commit-base; componentes de edição de produto não foram modificados.

## Publicação

Pendente autorização explícita para publicar no GitHub typeacai-design/delivery-saas, Vercel wedelivery.site e aplicar a migração no Supabase operacional iqacuakyyzhrsrjzlnai. O APK de testes requer que a nova API esteja publicada antes do uso da aba Relatórios. Nenhum pedido, cobrança ou registro real foi alterado. Não houve homologação em Android físico.
