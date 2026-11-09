CREATE OR REPLACE FUNCTION public.atualizar_valor_sessao_mesa()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_sessao_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN v_sessao_id := NEW.sessao_mesa_id;
  ELSIF TG_OP = 'UPDATE' THEN v_sessao_id := COALESCE(NEW.sessao_mesa_id, OLD.sessao_mesa_id);
  ELSIF TG_OP = 'DELETE' THEN v_sessao_id := OLD.sessao_mesa_id;
  END IF;

  IF v_sessao_id IS NOT NULL THEN
    UPDATE sessoes_mesa
    SET valor_total = COALESCE((
      SELECT SUM(p.valor_total) FROM pedidos p
      WHERE p.sessao_mesa_id = v_sessao_id AND p.status NOT IN ('cancelado')
    ), 0), updated_at = NOW()
    WHERE id = v_sessao_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$

