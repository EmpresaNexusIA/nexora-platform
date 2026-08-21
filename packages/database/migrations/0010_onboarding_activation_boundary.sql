-- ============================================================
-- Migración 0010 — Frontera de Onboarding y Activación de Clientes
--
--  1. Agrega public.clientes.provisioned_tenant_id nullable con FK a public.tenants(id).
--  2. Crea un índice único parcial (idx_clientes_provisioned_tenant_id) para garantizar
--     que un cliente CRM no pueda aprovisionar más de un tenant.
--  3. Agrega estado 'onboarding' al CHECK constraint de public.clientes.
--  4. Formaliza CHECK constraints para tenants.status y users.status.
--  5. Endurece find_user_by_email() con comparación case-insensitive (LOWER).
--  6. Crea la función angosta SECURITY DEFINER public.complete_client_activation().
--  7. Asigna EXECUTE de complete_client_activation únicamente a api_user y lo revoca de PUBLIC.
--  8. api_user NO recupera acceso directo a public.clientes.
-- ============================================================

BEGIN;

--> statement-breakpoint
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS provisioned_tenant_id uuid REFERENCES public.tenants(id);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_provisioned_tenant_id
  ON public.clientes (provisioned_tenant_id)
  WHERE provisioned_tenant_id IS NOT NULL;

--> statement-breakpoint
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_estado_check;

--> statement-breakpoint
ALTER TABLE public.clientes ADD CONSTRAINT clientes_estado_check
  CHECK (estado IN ('nuevo', 'contactado', 'presupuestando', 'vendido', 'onboarding', 'activo'));

--> statement-breakpoint
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_status_check;

--> statement-breakpoint
ALTER TABLE public.tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('pending_activation', 'active', 'suspended', 'cancelled', 'maintenance'));

--> statement-breakpoint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;

--> statement-breakpoint
ALTER TABLE public.users ADD CONSTRAINT users_status_check
  CHECK (status IN ('invited', 'active', 'inactive', 'suspended', 'pending_mfa'));

--> statement-breakpoint
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
  WHERE lower(u.email) = lower(p_email)
    AND u.deleted_at IS NULL
  LIMIT 1;
$$;

--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.find_user_by_email(varchar) FROM PUBLIC;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.find_user_by_email(varchar) TO api_user;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.complete_client_activation(
  p_client_id uuid,
  p_tenant_id uuid,
  p_user_id uuid,
  p_password_hash varchar
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_updated integer;
  v_tenant_updated integer;
  v_user_updated integer;
BEGIN
  -- Validar formato bcrypt de password_hash
  IF p_password_hash IS NULL OR p_password_hash !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$' THEN
    RAISE EXCEPTION 'Formato de password_hash invalido para bcrypt';
  END IF;

  -- 1. Actualizar exactamente 1 fila en clientes
  UPDATE public.clientes
  SET estado = 'activo',
      actualizado_en = now()
  WHERE id = p_client_id
    AND estado = 'onboarding'
    AND provisioned_tenant_id = p_tenant_id;

  GET DIAGNOSTICS v_client_updated = ROW_COUNT;
  IF v_client_updated <> 1 THEN
    RAISE EXCEPTION 'Precondicion fallida: cliente no encontrado en estado onboarding con tenant_id coincidente';
  END IF;

  -- 2. Actualizar exactamente 1 fila en tenants
  UPDATE public.tenants
  SET status = 'active',
      updated_at = now()
  WHERE id = p_tenant_id
    AND status = 'pending_activation';

  GET DIAGNOSTICS v_tenant_updated = ROW_COUNT;
  IF v_tenant_updated <> 1 THEN
    RAISE EXCEPTION 'Precondicion fallida: tenant no encontrado en estado pending_activation';
  END IF;

  -- 3. Actualizar exactamente 1 fila en users
  UPDATE public.users
  SET status = 'active',
      password_hash = p_password_hash,
      updated_at = now()
  WHERE id = p_user_id
    AND tenant_id = p_tenant_id
    AND status = 'invited';

  GET DIAGNOSTICS v_user_updated = ROW_COUNT;
  IF v_user_updated <> 1 THEN
    RAISE EXCEPTION 'Precondicion fallida: usuario no encontrado en estado invited perteneciente al tenant';
  END IF;
END;
$$;

--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.complete_client_activation(uuid, uuid, uuid, varchar) FROM PUBLIC;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.complete_client_activation(uuid, uuid, uuid, varchar) TO api_user;

COMMIT;

-- ============================================================
-- DOWN MIGRATION (ROLLBACK):
--
-- REVOKE ALL PRIVILEGES ON FUNCTION public.complete_client_activation(uuid, uuid, uuid, varchar) FROM api_user;
-- DROP FUNCTION IF EXISTS public.complete_client_activation(uuid, uuid, uuid, varchar);
--
-- ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;
-- ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
--
-- ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_estado_check;
-- ALTER TABLE public.clientes ADD CONSTRAINT clientes_estado_check
--   CHECK (estado IN ('nuevo', 'contactado', 'presupuestando', 'vendido', 'activo'));
--
-- DROP INDEX IF EXISTS idx_clientes_provisioned_tenant_id;
-- ALTER TABLE public.clientes DROP COLUMN IF EXISTS provisioned_tenant_id;
-- ============================================================
