-- Migration 025: garantir chave 'admin' em saas_config + policy service_role
-- A rota /api/admin/config usa service_role key (não auth.uid()),
-- então precisa de policy que permita escrita sem auth.

-- Garante a chave 'admin' com defaults razoáveis
INSERT INTO saas_config (chave, valor) VALUES
  ('admin', '{
    "valorMensalidade": 99.90,
    "valorMinimo": 49.90,
    "emailCobranca": "",
    "nomeAdmin": "Rick Machado",
    "emailAdmin": "ranieryrick4@gmail.com",
    "termosUso": "Termos de uso padrão para lojistas...",
    "politicaPrivacidade": "Política de privacidade padrão...",
    "notificarVencimento": true,
    "notificarNovoCadastro": true,
    "notificarInadimplencia": true
  }')
ON CONFLICT (chave) DO NOTHING;

-- Como a API usa service_role, que ignora RLS, não precisamos
-- mudar policy. Mas se a app for acessada com anon, public SELECT é OK.
