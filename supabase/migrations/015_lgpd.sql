-- Migration 015: LGPD + páginas editáveis pelo admin

CREATE TABLE IF NOT EXISTS consentimentos_lgpd (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('politica', 'marketing')),
  consentido BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consentimentos_tenant ON consentimentos_lgpd(tenant_id);

ALTER TABLE consentimentos_lgpd ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver consentimentos da loja" ON consentimentos_lgpd
  FOR SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Inserir consentimentos" ON consentimentos_lgpd
  FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE TABLE IF NOT EXISTS saas_paginas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  conteudo_html TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO saas_paginas (slug, titulo, conteudo_html) VALUES
  ('privacidade', 'Política de Privacidade', '<h1>Política de Privacidade</h1><p>A We Delivery respeita a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018). Coletamos apenas os dados necessários para processar seus pedidos: nome, telefone, endereço de entrega e data de nascimento. Esses dados são compartilhados exclusivamente com o estabelecimento onde você fez o pedido.</p><h2>Seus direitos</h2><p>Você pode solicitar a exclusão ou anonimização dos seus dados a qualquer momento entrando em contato com o estabelecimento.</p>'),
  ('termos', 'Termos de Uso', '<h1>Termos de Uso</h1><p>Ao utilizar a We Delivery você concorda com os termos aqui apresentados. O serviço conecta clientes a estabelecimentos, sendo intermediário na comunicação de pedidos via WhatsApp. Não nos responsabilizamos por产品质量 ou entrega, responsabilidade exclusiva do estabelecimento.</p>')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE saas_paginas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos leem páginas" ON saas_paginas FOR SELECT USING (true);
CREATE POLICY "Admin edita páginas" ON saas_paginas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'ranieryrick4@gmail.com')
  );

COMMENT ON TABLE consentimentos_lgpd IS 'Registro de consentimento do cliente (LGPD)';
