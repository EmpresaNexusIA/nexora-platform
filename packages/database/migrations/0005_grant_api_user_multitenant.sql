-- ============================================================
-- MIGRACION 0005: Grant api_user sobre tablas multi-tenant
-- Nexora Platform
-- Fecha: 13/8/2026
-- ============================================================
--
-- CONTEXTO:
--   Las politicas RLS sobre users/tenants existen (migraciones 0000-0003)
--   pero api_user (el rol runtime) nunca recibio GRANT sobre esas tablas.
--   La prueba Multi-Tenancy E2E lo demostro: "permission denied for table".
--
--   Sin GRANT, api_user no puede acceder a la tabla -> RLS ni se evalua.
--   Esta migracion cierra ese hueco.
--
--   RLS + FORCE RLS siguen siendo el limite de seguridad real.
--   Los GRANTs solo dan acceso base; las policies filtran las filas.
--
-- PRUEBA QUE LO DETECTO:
--   docker exec -i nexora-postgres psql -U nexora_admin -d nexora_dev < test_multitenancy_e2e_viva.sql
--   Resultado: "permission denied for table users/tenants" en todos los casos
--
-- VEREDICTO:
--   QUE: GRANT SELECT, INSERT, UPDATE, DELETE sobre users y tenants a api_user
--   POR QUE: api_user es el rol runtime (NOBYPASSRLS). Sin GRANT no puede
--   operar. Las policies RLS + FORCE son las que aislan por tenant.
--   Descartado: no darle grants (el runtime no funciona) · darle BYPASSRLS
--   (viola ADR-0008) · darle acceso a postgres (viola la regla "Apps JAMAS
--   como postgres").
--   Revisita: cuando se agreguen mas tablas multi-tenant, incluir sus grants
--   en la migracion correspondiente (no olvidar como paso con 0000-0003).
-- ============================================================

-- Esquema: asegurar acceso al schema public
GRANT USAGE ON SCHEMA public TO api_user;

-- Tablas multi-tenant: acceso base (RLS + FORCE filtran las filas)
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO api_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants TO api_user;

-- Funciones que usan las policies RLS y los DEFAULT de columnas
GRANT EXECUTE ON FUNCTION get_current_tenant_id() TO api_user;
GRANT EXECUTE ON FUNCTION should_show_deleted() TO api_user;
GRANT EXECUTE ON FUNCTION generate_uuid_v7() TO api_user;

-- ============================================================
-- NOTA: las trigger functions (block_physical_delete, fn_users_soft_delete,
-- update_updated_at_column) NO necesitan grant porque se ejecutan con los
-- privilegios del OWNER de la funcion, no del que llama.
--
-- NOTA: la tabla roles NO se incluye en este grant porque no se confirmed
-- que tenga RLS. Se agrega cuando se verifique su aislamiento por tenant.
-- ============================================================
