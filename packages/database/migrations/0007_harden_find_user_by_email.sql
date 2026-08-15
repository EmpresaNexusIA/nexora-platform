-- 0007_harden_find_user_by_email.sql
-- Endurece la única frontera pre-tenant permitida para POST /login.
--
-- find_user_by_email es SECURITY DEFINER porque debe descubrir el tenant
-- antes de que exista contexto RLS. Solo api_user puede invocarla.
-- PostgreSQL concede EXECUTE a PUBLIC por defecto; se revoca explícitamente.

BEGIN;

REVOKE ALL PRIVILEGES
ON FUNCTION public.find_user_by_email(varchar)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.find_user_by_email(varchar)
TO api_user;

-- Previene que futuras funciones creadas por nexora_admin vuelvan a recibir
-- EXECUTE para PUBLIC de manera implícita.
ALTER DEFAULT PRIVILEGES
FOR ROLE nexora_admin
IN SCHEMA public
REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;
