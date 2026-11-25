-- Equipe v2 (Cozinha, Garçom, Motoboy) — base.
-- 1) Remove o sistema antigo de equipe (membros_equipe com senha em texto puro + contas internas de atendente).
-- 2) Funções da equipe: kitchen (Cozinha), attendant (Garçom), motoboy. Identidade por celular (usuarios_loja.telefone).
-- 3) A equipe não lê/escreve pedidos direto no banco: tudo passa pelas rotas /api/equipe-app (service role),
--    que entregam só os campos de cada função (ex.: cozinha sem valores e sem telefone).
-- 4) Notificações: inscrições push por aparelho, aviso em tempo real (broadcast sem dados sensíveis) e
--    disparo HTTP (pg_net) para /api/push/evento quando um pedido entra ou muda de etapa.

-- 1) Sistema antigo
DELETE FROM auth.users
WHERE email LIKE '%@atendente.we-delivery.internal'
  AND id IN (SELECT user_id FROM public.usuarios_loja WHERE role <> 'owner');
DELETE FROM public.usuarios_loja WHERE role NOT IN ('owner', 'manager');
DROP TABLE IF EXISTS public.membros_equipe CASCADE;

-- 2) Funções e dados da equipe
ALTER TABLE public.usuarios_loja DROP CONSTRAINT IF EXISTS usuarios_loja_role_check;
ALTER TABLE public.usuarios_loja ADD CONSTRAINT usuarios_loja_role_check
  CHECK (role IN ('owner', 'manager', 'kitchen', 'attendant', 'motoboy'));
ALTER TABLE public.usuarios_loja ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.usuarios_loja ADD COLUMN IF NOT EXISTS disponivel boolean NOT NULL DEFAULT false;

-- 3) Equipe sem acesso direto a pedidos/mesas/cupons/motoboys: remove os papéis de equipe das policies.
DO $$
DECLARE
  p record;
  v_qual text;
  v_check text;
  v_staff text := '(attendant|kitchen|delivery|motoboy)';
BEGIN
  FOR p IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('pedidos', 'pedido_itens', 'pedido_complementos', 'pedido_status_historico', 'sessoes_mesa', 'mesas', 'cupons', 'motoboys')
      AND (coalesce(qual, '') || coalesce(with_check, '')) ~ v_staff
  LOOP
    IF (coalesce(p.qual, '') || coalesce(p.with_check, '')) ~ '''(owner|manager)''' THEN
      v_qual := regexp_replace(regexp_replace(p.qual, ',\s*''' || v_staff || '''::text', '', 'g'), '''' || v_staff || '''::text,\s*', '', 'g');
      v_check := regexp_replace(regexp_replace(p.with_check, ',\s*''' || v_staff || '''::text', '', 'g'), '''' || v_staff || '''::text,\s*', '', 'g');
      EXECUTE format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename)
        || CASE WHEN v_qual IS NOT NULL THEN format(' USING (%s)', v_qual) ELSE '' END
        || CASE WHEN v_check IS NOT NULL THEN format(' WITH CHECK (%s)', v_check) ELSE '' END;
    ELSE
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    END IF;
  END LOOP;
END $$;

-- 3b) Entregador: a entrega fica com uma pessoa da equipe (motoboy), não mais com a tabela antiga motoboys.
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS entregador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS entregador_em timestamptz;
CREATE INDEX IF NOT EXISTS pedidos_entregador_idx ON public.pedidos (tenant_id, entregador_id) WHERE entregador_id IS NOT NULL;

-- 4a) Inscrições de notificação push (gerenciadas só pelo servidor)
CREATE TABLE IF NOT EXISTS public.push_inscricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_inscricoes_tenant_user_idx ON public.push_inscricoes (tenant_id, user_id);
ALTER TABLE public.push_inscricoes ENABLE ROW LEVEL SECURITY;

-- 4b) Aviso de mudança em pedido: broadcast (só id e etapa) + chamada ao servidor de notificações.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.equipe_avisar_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_url text;
  v_segredo text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.entregador_id IS NOT DISTINCT FROM OLD.entregador_id THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM realtime.send(
      jsonb_build_object('pedido_id', NEW.id, 'status', NEW.status::text),
      'pedido', 'equipe:' || NEW.tenant_id::text, false);
  EXCEPTION WHEN OTHERS THEN NULL; -- aviso em tempo real nunca bloqueia o pedido
  END;

  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'wd_push_url';
  SELECT decrypted_secret INTO v_segredo FROM vault.decrypted_secrets WHERE name = 'wd_push_segredo';
  IF v_url IS NOT NULL AND v_segredo IS NOT NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := v_url,
        body := jsonb_build_object('pedido_id', NEW.id, 'tenant_id', NEW.tenant_id, 'status', NEW.status::text,
                                   'evento', CASE WHEN TG_OP = 'INSERT' THEN 'novo' WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status' ELSE 'entregador' END,
                                   'entregador_id', NEW.entregador_id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-wd-segredo', v_segredo),
        timeout_milliseconds := 4000);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_equipe_avisar_pedido ON public.pedidos;
CREATE TRIGGER trg_equipe_avisar_pedido
  AFTER INSERT OR UPDATE OF status, entregador_id ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.equipe_avisar_pedido();

-- 5) Busca de conta da equipe pelo e-mail interno (derivado do celular). Só o servidor (service role) usa.
CREATE OR REPLACE FUNCTION public.equipe_usuario_por_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT u.id FROM auth.users u WHERE lower(u.email) = lower(p_email) LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.equipe_usuario_por_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.equipe_usuario_por_email(text) TO service_role;
