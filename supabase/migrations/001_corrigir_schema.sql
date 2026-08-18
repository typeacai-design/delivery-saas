-- Migration: Adicionar coluna status na tabela tenants + corrigir schema
-- Executar no Supabase SQL Editor

-- 1. Adicionar coluna status se não existir
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_approval';

-- 2. Garantir que a coluna email existe
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. Garantir que a coluna numero existe
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS numero TEXT;

-- 4. Garantir que a coluna cpf existe
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cpf TEXT;

-- 5. Garantir que a coluna nome_responsavel existe
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nome_responsavel TEXT;

-- 6. Criar índice para buscar tenant por slug (se não existir)
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- 7. Criar índice para buscar tenant por status (se não existir)
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- 8. Atualizar registros existentes para ter status padrão
UPDATE tenants SET status = 'pending_approval' WHERE status IS NULL OR status = '';

-- 9. Tabela de pedidos (garantir estrutura)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_whatsapp TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_nome TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS bairro_entrega TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS taxa_bairro NUMERIC DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS troco_para NUMERIC;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'novo';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tempo_estimado_min INTEGER;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cupom_aplicado TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC DEFAULT 0;

-- 10. Tabela de itens do pedido
ALTER TABLE pedido_itens ADD COLUMN IF NOT EXISTS variante_id UUID;
ALTER TABLE pedido_itens ADD COLUMN IF NOT EXISTS variante_nome TEXT;
ALTER TABLE pedido_itens ADD COLUMN IF NOT EXISTS complementos JSONB DEFAULT '[]';
ALTER TABLE pedido_itens ADD COLUMN IF NOT EXISTS observacao TEXT;

-- 11. Tabela de clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- 12. Função para incrementar usos do cupom
CREATE OR REPLACE FUNCTION incrementar_usos_cupom(p_tenant_id UUID, p_codigo TEXT)
RETURNS void AS $$
BEGIN
  UPDATE cupons
  SET usos = COALESCE(usos, 0) + 1
  WHERE tenant_id = p_tenant_id AND codigo = p_codigo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Atualizar config da tabela tenants para permitir JSON
ALTER TABLE tenants ALTER COLUMN config TYPE JSONB USING config::JSONB;

-- 14. Commit
COMMIT;
