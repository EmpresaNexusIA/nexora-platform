-- ============================================================================
-- 0002_sp2_machinery — Maquinaria SP2 versionada (rescatada del entorno manual)
-- ============================================================================
-- Origen: dump nexora-sp2-2026-07-23.sql (entorno construido a mano vía psql).
-- Decisiones de arquitectura aplicadas:
--   * Outbox canónico = audit.outbox (el código de apps/orchestrator lo usa).
--     Las tablas fósiles public.outbox_events y outbox.outbox_events NO se
--     versionan (cero referencias en código, cero datos en el dump).
--   * fn_users_soft_delete() CORREGIDA: el trigger original insertaba el evento
--     en public.outbox_events (eslabón roto: el worker lee audit.outbox).
--     Ahora inserta en audit.outbox con payload camelCase (userId/tenantId),
--     que es lo que UserSoftDeletedHandler espera.
--   * Idempotente por diseño: corre limpio sobre la base restaurada (nexora_dev)
--     y también instala desde cero en un clon fresco.
--   * Roles api_user / nexora_maintenance_role se crean SIN login/password:
--     la provisión de credenciales es por entorno (secrets), no por migración.
-- ============================================================================

-- 1) Extensión criptográfica (uuid v4/v7, bytes aleatorios) -------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- 2) Schemas de plataforma ----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS orchestrator;

-- 3) Roles de plataforma (sin credenciales; eso vive en secrets por entorno) --
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_user') THEN
    CREATE ROLE api_user NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexora_maintenance_role') THEN
    CREATE ROLE nexora_maintenance_role NOLOGIN;
  END IF;
END
$do$;

-- 4) Enum del ciclo de vida del outbox ---------------------------------------
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'outbox_status' AND n.nspname = 'audit') THEN
    CREATE TYPE audit.outbox_status AS ENUM (
      'PENDING', 'PROCESSING', 'COMPLETED', 'RETRY', 'FAILED', 'DEAD_LETTER'
    );
  END IF;
END
$do$;

-- 5) Funciones utilitarias ----------------------------------------------------

-- UUID v7 (ids ordenables por tiempo) — DEFAULT de las tablas core
CREATE OR REPLACE FUNCTION public.generate_uuid_v7() RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  timestamp_ms bigint;
  bytes bytea;
BEGIN
  timestamp_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  bytes := gen_random_bytes(16);
  bytes := set_byte(bytes, 0, ((timestamp_ms >> 40) & 255)::int);
  bytes := set_byte(bytes, 1, ((timestamp_ms >> 32) & 255)::int);
  bytes := set_byte(bytes, 2, ((timestamp_ms >> 24) & 255)::int);
  bytes := set_byte(bytes, 3, ((timestamp_ms >> 16) & 255)::int);
  bytes := set_byte(bytes, 4, ((timestamp_ms >> 8) & 255)::int);
  bytes := set_byte(bytes, 5, (timestamp_ms & 255)::int);
  bytes := set_byte(bytes, 6, (get_byte(bytes, 6) & 15) | 112);
  bytes := set_byte(bytes, 8, (get_byte(bytes, 8) & 63) | 128);
  RETURN encode(bytes, 'hex')::uuid;
END;
$$;

-- Grupo B (Contexto Maestro): tablas donde el DELETE físico está prohibido
CREATE OR REPLACE FUNCTION public.block_physical_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Las eliminaciones fisicas estan prohibidas en Nexora Core. Por favor, usa UPDATE con deleted_at.';
END;
$$;

-- updated_at automático
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;

-- Helpers RLS
CREATE OR REPLACE FUNCTION public.get_current_tenant_id() RETURNS uuid
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.should_show_deleted() RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN COALESCE(current_setting('app.show_deleted', true) = 'true', false);
END;
$$;

-- Hard Delete controlado (solo vía función, con auditoría + bypass por transacción)
CREATE OR REPLACE FUNCTION public.execute_hard_delete_user(p_user_id uuid, p_reason text, p_executed_by text, p_request_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT pg_has_role(session_user, 'nexora_maintenance_role', 'USAGE') THEN
        RAISE EXCEPTION 'Acceso denegado: Solo miembros de nexora_maintenance_role pueden realizar esta operación.';
    END IF;

    INSERT INTO audit.hard_delete_audit (
        schema_name, table_name, record_id, reason, executed_by, request_id
    ) VALUES (
        'public', 'users', p_user_id::text, p_reason, p_executed_by, p_request_id
    );

    PERFORM set_config('app.allow_hard_delete', 'true', true);

    DELETE FROM public.users WHERE id = p_user_id;
END;
$$;

-- Soft Delete por trigger (Grupo A) — VERSIÓN CORREGIDA ----------------------
-- Antes: INSERT INTO outbox_events  -> resolvía a public.outbox_events (fósil,
-- nadie la lee). Ahora: INSERT INTO audit.outbox (la canónica del orquestador)
-- con payload camelCase tal como lo consume UserSoftDeletedHandler.
CREATE OR REPLACE FUNCTION public.fn_users_soft_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_user_id uuid;
    v_allow_hard_delete text;
    v_deleted_at timestamptz;
BEGIN
    -- 1. Bypass explícito para Hard Delete (lo activa execute_hard_delete_user)
    v_allow_hard_delete := COALESCE(current_setting('app.allow_hard_delete', true), 'false');
    IF v_allow_hard_delete = 'true' THEN
        RETURN OLD;
    END IF;

    -- 2. Soft Delete por defecto
    v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
    v_deleted_at := clock_timestamp();

    UPDATE users
    SET
        deleted_at = v_deleted_at,
        deleted_by = COALESCE(v_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    WHERE id = OLD.id;

    -- 3. Evento de dominio hacia el orquestador (tabla canónica audit.outbox)
    INSERT INTO audit.outbox (event_type, payload, request_id)
    VALUES (
        'user.soft_deleted',
        jsonb_build_object(
            'userId',    OLD.id,
            'tenantId',  OLD.tenant_id,
            'deletedBy', COALESCE(v_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
            'deletedAt', v_deleted_at
        ),
        NULLIF(current_setting('app.current_request_id', true), '')::uuid
    );

    -- 4. Cancelamos el DELETE físico
    RETURN NULL;
END;
$$;

-- 6) Tablas de plataforma -----------------------------------------------------

CREATE TABLE IF NOT EXISTS audit.hard_delete_audit (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    schema_name text NOT NULL,
    table_name text NOT NULL,
    record_id text NOT NULL,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    reason text NOT NULL,
    executed_by text NOT NULL,
    request_id uuid
);

CREATE TABLE IF NOT EXISTS audit.outbox (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    status audit.outbox_status DEFAULT 'PENDING'::audit.outbox_status NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 4 NOT NULL,
    next_attempt_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_log text,
    request_id uuid
);

CREATE TABLE IF NOT EXISTS orchestrator.dead_letter_queue (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    original_event_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    error_category text NOT NULL,
    error_log text,
    failed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orchestrator.idempotency_keys (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    event_id character varying(255) NOT NULL,
    request_id character varying(255),
    handler_name character varying(255) NOT NULL,
    processed_at timestamp with time zone DEFAULT now()
);

-- 7) Índices ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_outbox_polling ON audit.outbox USING btree (created_at)
    WHERE (status = ANY (ARRAY['PENDING'::audit.outbox_status, 'RETRY'::audit.outbox_status]));

CREATE UNIQUE INDEX IF NOT EXISTS uk_event_handler
    ON orchestrator.idempotency_keys (event_id, handler_name);

-- 8) Alinear defaults de ids core con uuid v7 (drift repo vs entorno canónico)
ALTER TABLE ONLY public.tenants     ALTER COLUMN id SET DEFAULT public.generate_uuid_v7();
ALTER TABLE ONLY public.users       ALTER COLUMN id SET DEFAULT public.generate_uuid_v7();
ALTER TABLE ONLY public.roles       ALTER COLUMN id SET DEFAULT public.generate_uuid_v7();
ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT public.generate_uuid_v7();

-- 9) Row Level Security -------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE ONLY public.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ONLY public.users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_policy ON public.tenants;
CREATE POLICY tenant_select_policy ON public.tenants FOR SELECT
    USING ((id = public.get_current_tenant_id()) AND ((deleted_at IS NULL) OR public.should_show_deleted()));

DROP POLICY IF EXISTS tenant_update_policy ON public.tenants;
CREATE POLICY tenant_update_policy ON public.tenants FOR UPDATE
    USING (id = public.get_current_tenant_id())
    WITH CHECK (id = public.get_current_tenant_id());

DROP POLICY IF EXISTS user_select_policy ON public.users;
CREATE POLICY user_select_policy ON public.users FOR SELECT
    USING ((tenant_id = public.get_current_tenant_id()) AND ((deleted_at IS NULL) OR public.should_show_deleted()));

DROP POLICY IF EXISTS user_insert_policy ON public.users;
CREATE POLICY user_insert_policy ON public.users FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS user_update_policy ON public.users;
CREATE POLICY user_update_policy ON public.users FOR UPDATE
    USING (tenant_id = public.get_current_tenant_id())
    WITH CHECK (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS user_delete_policy ON public.users;
CREATE POLICY user_delete_policy ON public.users FOR DELETE TO api_user
    USING ((tenant_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) AND (deleted_at IS NULL));

-- 10) Triggers ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_users_soft_delete ON public.users;
CREATE TRIGGER trg_users_soft_delete BEFORE DELETE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.fn_users_soft_delete();

DROP TRIGGER IF EXISTS block_delete_tenants ON public.tenants;
CREATE TRIGGER block_delete_tenants BEFORE DELETE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.block_physical_delete();

DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_roles_updated_at ON public.roles;
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_permissions_updated_at ON public.permissions;
CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON public.permissions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11) Grants (fieles al entorno rescatado) ------------------------------------
GRANT USAGE ON SCHEMA public TO api_user;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.permissions TO api_user;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.roles TO api_user;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.roles_to_permissions TO api_user;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.tenants TO api_user;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.users TO api_user;

REVOKE ALL ON FUNCTION public.execute_hard_delete_user(uuid, text, text, uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.execute_hard_delete_user(uuid, text, text, uuid) TO nexora_maintenance_role;

-- ============================================================================
-- NOTAS (post-0002, fuera de alcance aquí):
--   * Limpieza de la base viva: DROP de public.outbox_events, schema outbox y
--     sus funciones-helper = tarea separada y deliberada (no en esta migración).
--   * Cuando el worker tenga credenciales propias (no superuser), definir
--     GRANTs sobre schemas audit/orchestrator — decisión de credenciales,
--     documentarla en un ADR de conectividad del orchestrator.
-- ============================================================================
