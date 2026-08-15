-- 0008_revoke_public_default_function_execute.sql
-- Corrige el alcance de ALTER DEFAULT PRIVILEGES aplicado en 0007.
--
-- PostgreSQL concede EXECUTE sobre funciones nuevas a PUBLIC de forma global.
-- Un REVOKE limitado con "IN SCHEMA public" no puede revertir ese privilegio
-- global. Por eso la revocacion debe declararse sin limitar el esquema.

BEGIN;

ALTER DEFAULT PRIVILEGES
FOR ROLE nexora_admin
REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;
