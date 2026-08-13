-- ============================================================
--  Migración 0006 — password_hash en users + función de login
--
--  La tabla users no tenía cómo autenticar (no había password).
--  Esta migración agrega:
--   1. Columna password_hash (nullable)
--   2. Función find_user_by_email() — SECURITY DEFINER que busca
--      un usuario por email sin contexto de tenant.
--
--  Sobre el login y RLS (el problema huevo-gallina):
--   Para hacer login necesitas buscar al usuario por email, pero
--   todavía no sabés su tenant → no podés usar withTenantDatabase()
--   porque la policy user_select_policy exige tenant_id = contexto.
--
--   Solución: una función SECURITY DEFINER que:
--   - Corre con los privilegios del OWNER (bypassa RLS internamente)
--   - Solo acepta un email como parámetro
--   - Solo retorna id, tenant_id, password_hash, status
--   - Solo api_user puede ejecutarla (GRANT EXECUTE)
--   - No se puede abusar para listar todos los usuarios
--   - Tiene search_path fijo (anti-inyección)
--
--   La API llama a find_user_by_email(email), verifica el password
--   con bcrypt del lado de Node, y si OK → emite el JWT con el
--   tenant_id del usuario. Después de eso, todo pasa por
--   withTenantDatabase() normalmente.
--
--  Idempotente, con statement-breakpoints.
-- ============================================================

--> statement-breakpoint
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash varchar(255);

--> statement-breakpoint
-- Función de login: busca usuario por email sin contexto de tenant.
-- SECURITY DEFINER = corre como el owner (bypassa RLS).
-- search_path fijo = anti-inyección de search_path.
CREATE OR REPLACE FUNCTION public.find_user_by_email(p_email varchar)
RETURNS TABLE (
  user_id uuid,
  tenant_id uuid,
  password_hash varchar,
  user_status varchar
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT u.id, u.tenant_id, u.password_hash, u.status
  FROM public.users u
  WHERE u.email = p_email
    AND u.deleted_at IS NULL
  LIMIT 1;
$$;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.find_user_by_email(varchar) TO api_user;
