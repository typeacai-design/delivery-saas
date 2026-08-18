# Inventário para Fase 3 — suposições `tenant_id = user.id`

Varredura de 2026-08-13. Estes fluxos ainda assumem que o usuário Auth é o tenant e devem migrar para `authenticatedTenant`/loja ativa antes de considerar suporte multi-loja completo:

- APIs operacionais: `api/pedidos`, `api/clientes`, `api/despesas`, `api/mesas`, `api/turnos-capacidade`, `api/tickets`, `api/whatsapp-pedido`.
- Ciclo da loja: `api/onboarding`, `api/trial/verificar`, `api/revalidate-cardapio`.
- UI com escrita/leitura direta: `dashboard/mensalidade`, `dashboard/configuracoes` e `dashboard/cardapio`.
- `api/diagnostico/session` também contém a suposição, mas a rota está bloqueada em produção e deve ser removida/limitada na fase técnica.

As rotas `api/mensalidades/gerar`, `api/pix/gerar`, `api/auditoria`, `api/upload-produto` e `api/upload-complemento` foram corrigidas na Fase 2 porque eram dependências diretas dos controles de ACL desta migration.