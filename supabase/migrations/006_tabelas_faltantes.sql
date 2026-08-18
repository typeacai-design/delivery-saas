-- ================================================
-- Migration 006: Tabelas faltantes
-- Cupons, categorias_complementos, mensalidades,
-- data_nascimento em clientes
-- ================================================

-- 1. Cupons de desconto
CREATE TABLE IF NOT EXISTS cupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('percentual', 'valor_fixo')),
  valor DECIMAL(10,2) NOT NULL,
  valor_minimo_pedido DECIMAL(10,2) DEFAULT 0,
  validade DATE NOT NULL,
  max_usos INTEGER DEFAULT NULL,
  usos_atuais INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, codigo)
);

ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cupons visíveis ao tenant" ON cupons
  FOR ALL USING (tenant_id = auth.uid());

-- 2. Categorias de complementos
CREATE TABLE IF NOT EXISTS categorias_complementos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  obrigatorio BOOLEAN DEFAULT false,
  max_selecoes INTEGER DEFAULT NULL,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categorias_complementos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categorias de complementos visíveis ao tenant" ON categorias_complementos
  FOR ALL USING (tenant_id = auth.uid());

-- 3. Vincular complementos às categorias (muitos-para-muitos)
CREATE TABLE IF NOT EXISTS complemento_categorias (
  complemento_id UUID REFERENCES complementos(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES categorias_complementos(id) ON DELETE CASCADE,
  PRIMARY KEY (complemento_id, categoria_id)
);

ALTER TABLE complemento_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Complemento-categorias visível ao tenant" ON complemento_categorias
  FOR ALL USING (
    complemento_id IN (SELECT id FROM complementos WHERE tenant_id = auth.uid())
    OR categoria_id IN (SELECT id FROM categorias_complementos WHERE tenant_id = auth.uid())
  );

-- 4. Mensalidades dos lojistas
CREATE TABLE IF NOT EXISTS mensalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'vencido')),
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, mes, ano)
);

ALTER TABLE mensalidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mensalidades visíveis ao tenant" ON mensalidades
  FOR ALL USING (tenant_id = auth.uid());

-- 5. Adicionar data_nascimento aos clientes
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS data_nascimento DATE;

COMMENT ON COLUMN clientes.data_nascimento IS 'Data de nascimento do cliente. Usado para marketing de aniversário.';

-- 6. Adicionar status_pagamento à tabela tenants (para visão rápida admin)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'pendente' CHECK (status_pagamento IN ('pago', 'pendente', 'vencido'));

-- 7. Adicionar cidade e telefone à tabela tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT;

-- 8. Adicionar bairro à tabela clientes (endereço de entrega padrão)
-- Já existe 'bairro', mas vamos garantir que é usado para entrega
-- O campo 'endereco' é o endereço completo
