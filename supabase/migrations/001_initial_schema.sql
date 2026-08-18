-- ================================================
-- SCHEMA: delivery-saas multi-tenant
-- ================================================

-- Tabela de tenants (empresas/restaurantes)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  cnpj TEXT,
  config JSONB DEFAULT '{}',
  logo_url TEXT,
  cor_principal TEXT DEFAULT '#000000',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem seu próprio tenant" ON tenants
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuários atualizam seu próprio tenant" ON tenants
  FOR UPDATE USING (auth.uid() = id);

-- ================================================
-- CARDÁPIO
-- ================================================

-- Categorias do cardápio
CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categorias visíveis ao tenant" ON categorias
  FOR ALL USING (tenant_id = auth.uid());

-- Produtos
CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  imagem_url TEXT,
  preco DECIMAL(10,2) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Produtos visíveis ao tenant" ON produtos
  FOR ALL USING (tenant_id = auth.uid());

-- Variantes (tamanho P/M/G)
CREATE TABLE IF NOT EXISTS variantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  preco_adicional DECIMAL(10,2) DEFAULT 0
);

ALTER TABLE variantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Variantes visíveis ao tenant" ON variantes
  FOR ALL USING (
    produto_id IN (SELECT id FROM produtos WHERE tenant_id = auth.uid())
  );

-- Complementos (adicionais)
CREATE TABLE IF NOT EXISTS complementos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  preco DECIMAL(10,2) NOT NULL,
  ativo BOOLEAN DEFAULT true
);

ALTER TABLE complementos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Complementos visíveis ao tenant" ON complementos
  FOR ALL USING (tenant_id = auth.uid());

-- Relação produto-complementos
CREATE TABLE IF NOT EXISTS produto_complementos (
  produto_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
  complemento_id UUID REFERENCES complementos(id) ON DELETE CASCADE,
  PRIMARY KEY (produto_id, complemento_id)
);

ALTER TABLE produto_complementos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Produto-complementos visível ao tenant" ON produto_complementos
  FOR ALL USING (
    produto_id IN (SELECT id FROM produtos WHERE tenant_id = auth.uid())
  );

-- ================================================
-- CLIENTES E PEDIDOS
-- ================================================

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  cep TEXT,
  endereco TEXT,
  bairro TEXT,
  referencia TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clientes visíveis ao tenant" ON clientes
  FOR ALL USING (tenant_id = auth.uid());

-- Pedidos
CREATE TYPE pedido_status AS ENUM ('novo', 'preparando', 'pronto', 'saiu', 'entregue', 'cancelado');

CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id),
  status pedido_status DEFAULT 'novo',
  valor_total DECIMAL(10,2) NOT NULL,
  taxa_entrega DECIMAL(10,2) DEFAULT 0,
  forma_pagamento TEXT[] DEFAULT '{}',
  valor_pago DECIMAL(10,2)[] DEFAULT '{}',
  troco DECIMAL(10,2) DEFAULT 0,
  agendamento TEXT,
  observacoes TEXT,
  data_criacao TIMESTAMPTZ DEFAULT NOW(),
  data_atualizacao TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pedidos visíveis ao tenant" ON pedidos
  FOR ALL USING (tenant_id = auth.uid());

-- Itens do pedido
CREATE TABLE IF NOT EXISTS pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id),
  variante_id UUID REFERENCES variantes(id),
  nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  valor_unitario DECIMAL(10,2) NOT NULL,
  grupo TEXT
);

ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Itens visíveis ao tenant" ON pedido_itens
  FOR ALL USING (
    pedido_id IN (SELECT id FROM pedidos WHERE tenant_id = auth.uid())
  );

-- Complementos do item
CREATE TABLE IF NOT EXISTS pedido_complementos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_item_id UUID NOT NULL REFERENCES pedido_itens(id) ON DELETE CASCADE,
  complemento_id UUID REFERENCES complementos(id),
  nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  valor DECIMAL(10,2) NOT NULL
);

ALTER TABLE pedido_complementos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Complementos visíveis ao tenant" ON pedido_complementos
  FOR ALL USING (
    pedido_item_id IN (SELECT id FROM pedido_itens WHERE pedido_id IN (SELECT id FROM pedidos WHERE tenant_id = auth.uid()))
  );

-- ================================================
-- ESTOQUE
-- ================================================

-- Insumos
CREATE TABLE IF NOT EXISTS insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL,
  quantidade_atual DECIMAL(10,2) DEFAULT 0,
  estoque_minimo DECIMAL(10,2) DEFAULT 0,
  custo_unitario DECIMAL(10,2) DEFAULT 0
);

ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insumos visíveis ao tenant" ON insumos
  FOR ALL USING (tenant_id = auth.uid());

-- Relação produto-insumos (receita)
CREATE TABLE IF NOT EXISTS produto_insumos (
  produto_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
  insumo_id UUID REFERENCES insumos(id) ON DELETE CASCADE,
  quantidade_necessaria DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (produto_id, insumo_id)
);

ALTER TABLE produto_insumos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Produto-insumos visível ao tenant" ON produto_insumos
  FOR ALL USING (
    produto_id IN (SELECT id FROM produtos WHERE tenant_id = auth.uid())
  );

-- Movimentações de estoque
CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id UUID NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade DECIMAL(10,2) NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Movimentações visíveis ao tenant" ON movimentacoes_estoque
  FOR ALL USING (
    insumo_id IN (SELECT id FROM insumos WHERE tenant_id = auth.uid())
  );

-- ================================================
-- ENDEREÇOS DE ENTREGA
-- ================================================

CREATE TABLE IF NOT EXISTS enderecos_entrega (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bairro TEXT NOT NULL,
  taxa DECIMAL(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE enderecos_entrega ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Endereços visíveis ao tenant" ON enderecos_entrega
  FOR ALL USING (tenant_id = auth.uid());

-- ================================================
-- FUNCTIONS E TRIGGERS
-- ================================================

-- Function para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function para criar tenant automaticamente no signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenants (id, nome, slug)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Minha Empresa'),
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'nome', 'empresa'), ' ', '-')) || '-' || LEFT(NEW.id::text, 8)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
