-- Adiciona perfil 'atendimento' na constraint de membros_equipe
ALTER TABLE public.membros_equipe DROP CONSTRAINT IF EXISTS membros_equipe_perfil_check;
ALTER TABLE public.membros_equipe
  ADD CONSTRAINT membros_equipe_perfil_check
  CHECK (perfil IN ('owner', 'manager', 'attendant', 'cozinha', 'motoboy', 'atendimento'));
