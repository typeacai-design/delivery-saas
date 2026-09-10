-- Migration 085: Mesa aberta + Equipes + Tempo de preparo em pico
-- Executado em: 2026-09-09

-- =============================================
-- 1. TEMPO DE PREPARO EM DIAS DE PICO
-- =============================================
-- Adiciona campo para configurar tempo extra em dias de pico

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tempo_preparo_extra_minutos INTEGER DEFAULT 0;
COMMENT ON COLUMN tenants.tempo_preparo_extra_minutos IS 'Tempo extra de preparo em minutos para dias de pico (0 = desativado)';

-- =============================================
-- 2. SESSOES DE MESA ABERTA
-- =============================================
-- Rastrea mesas abertas para permitir múltiplos pedidos na mesma sessão

CREATE TABLE IF NOT EXISTS sessoes_mesa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_nome TEXT NOT NULL,
  cliente_whatsapp TEXT,
  mesa_numero TEXT NOT NULL,
  data_abertura TIMESTAMPTZ DEFAULT NOW(),
  data_fechamento TIMESTAMPTZ,
  valor_total DECIMAL(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada', 'cancelada')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessoes_mesa_tenant ON sessoes_mesa(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_mesa_status ON sessoes_mesa(status);

-- Vincula pedidos a sessões de mesa
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS sessao_mesa_id UUID REFERENCES sessoes_mesa(id) ON DELETE SET NULL;

-- Trigger para atualizar valor total da sessão quando pedido muda
CREATE OR REPLACE FUNCTION atualizar_valor_sessao_mesa()
RETURNS TRIGGER AS $$
DECLARE
  v_sessao_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_sessao_id := NEW.sessao_mesa_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_sessao_id := COALESCE(NEW.sessao_mesa_id, OLD.sessao_mesa_id);
  ELSIF TG_OP = 'DELETE' THEN
    v_sessao_id := OLD.sessao_mesa_id;
  END IF;

  IF v_sessao_id IS NOT NULL THEN
    UPDATE sessoes_mesa
    SET valor_total = COALESCE((
      SELECT SUM(p.valor_total)
      FROM pedidos p
      WHERE p.sessao_mesa_id = v_sessao_id
      AND p.status NOT IN ('cancelado')
    ), 0),
    updated_at = NOW()
    WHERE id = v_sessao_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualizar_valor_sessao_mesa ON pedidos;
CREATE TRIGGER trigger_atualizar_valor_sessao_mesa
AFTER INSERT OR UPDATE OR DELETE ON pedidos
FOR EACH ROW EXECUTE FUNCTION atualizar_valor_sessao_mesa();

-- =============================================
-- 3. EQUIPES COM PERFIS
-- =============================================
-- Usuarios da equipe com acessos diferenciados (cozinha, motoboy)

CREATE TABLE IF NOT EXISTS membros_equipe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('owner', 'manager', 'attendant', 'cozinha', 'motoboy')),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_membros_equipe_username ON membros_equipe(username);
CREATE INDEX IF NOT EXISTS idx_membros_equipe_tenant ON membros_equipe(tenant_id);
CREATE INDEX IF NOT EXISTS idx_membros_equipe_perfil ON membros_equipe(perfil);

-- Politicas RLS para membros_equipe
ALTER TABLE membros_equipe ENABLE ROW LEVEL SECURITY;

-- Owner e manager gerenciam membros
CREATE POLICY "owner_manager_gerenciam_equipe" ON membros_equipe
  FOR ALL USING (
    tenant_id IN (
      SELECT t.id FROM tenants t
      JOIN auth.users u ON t.owner_id = u.id
      WHERE u.id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM membros_equipe me
      WHERE me.tenant_id = membros_equipe.tenant_id
      AND me.user_id = auth.uid()
      AND me.perfil IN ('owner', 'manager')
    )
  );

-- Cada membro vê a si mesmo
CREATE POLICY "membro_vê_a_si" ON membros_equipe
  FOR SELECT USING (user_id = auth.uid());

-- =============================================
-- 4. CONFIGURAÇÃO DE TEMPO DE PICO
-- =============================================
-- Permite agendar dias de pico com antecedência

CREATE TABLE IF NOT EXISTS dias_pico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  tempo_extra_minutos INTEGER NOT NULL DEFAULT 30,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, data)
);

CREATE INDEX IF NOT EXISTS idx_dias_pico_tenant ON dias_pico(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dias_pico_data ON dias_pico(data);

-- Funcao para calcular tempo de preparo considerando pico
CREATE OR REPLACE FUNCTION calcular_tempo_preparo(p_tempo_base INTEGER, p_tenant_id UUID, p_data TIMESTAMPTZ)
RETURNS INTEGER AS $$
DECLARE
  v_extra INTEGER;
  v_ativo BOOLEAN;
  v_global INTEGER;
BEGIN
  -- Verifica se tenant tem configuracao de pico ativa
  SELECT tempo_preparo_extra_minutos INTO v_global FROM tenants WHERE id = p_tenant_id;
  IF v_global IS NULL OR v_global = 0 THEN v_global := 0; END IF;

  -- Verifica dia especifico
  SELECT tempo_extra_minutos INTO v_extra FROM dias_pico
  WHERE tenant_id = p_tenant_id AND data = p_data::DATE
  LIMIT 1;

  IF v_extra IS NOT NULL THEN
    RETURN p_tempo_base + v_extra;
  ELSIF v_global > 0 THEN
    RETURN p_tempo_base + v_global;
  ELSE
    RETURN p_tempo_base;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- NOTAS
-- =============================================
-- Para ativar o tempo de pico globalmente:
-- UPDATE tenants SET tempo_preparo_extra_minutos = 30 WHERE id = 'uuid-da-loja';

-- Para agendar um dia de pico especifico:
-- INSERT INTO dias_pico (tenant_id, data, tempo_extra_minutos, motivo)
-- VALUES ('uuid-da-loja', '2026-09-15', 30, 'Happy Hour especial');
