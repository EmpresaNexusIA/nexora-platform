-- ============================================================
-- 0013 — Roles de tienda (Dueño / Empleado)
--
--  1. Registra permisos tienda:* en public.permissions.
--  2. Crea roles Dueño y Empleado por cada tenant activo.
--  3. Vincula permisos a roles (Dueño=5, Empleado=3).
--  4. Backfill: usuarios existentes sin rol → Dueño.
--  5. Actualiza complete_client_activation para asignar Dueño
--     automáticamente al activar nuevos tenants.
--  6. Actualiza find_user_by_email para devolver role_name.
--
--  Idempotente (ON CONFLICT / WHERE NOT EXISTS / CREATE OR REPLACE).
-- ============================================================

BEGIN;

--> statement-breakpoint
-- 1. Permisos de tienda
INSERT INTO public.permissions (id, name, description) VALUES
  (gen_random_uuid(), 'tienda:pedidos:manage', 'Gestión de pedidos del panel de tienda'),
  (gen_random_uuid(), 'tienda:catalogo:manage', 'Gestión del catálogo de productos'),
  (gen_random_uuid(), 'tienda:clientes:manage', 'Gestión de clientes frecuentes'),
  (gen_random_uuid(), 'tienda:caja:read', 'Lectura del cierre de caja y reportes CSV'),
  (gen_random_uuid(), 'tienda:config:manage', 'Configuración de la tienda (precios, descuentos, whatsapp)')
ON CONFLICT (name) DO NOTHING;

--> statement-breakpoint
-- 2. Roles por tenant (Dueño + Empleado)
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT id FROM public.tenants WHERE deleted_at IS NULL
  LOOP
    INSERT INTO public.roles (id, tenant_id, name, description)
    SELECT gen_random_uuid(), t.id, 'Dueño',
           'Dueño del comercio con acceso completo al panel'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.roles
      WHERE tenant_id = t.id AND lower(name) = 'dueño' AND deleted_at IS NULL
    );

    INSERT INTO public.roles (id, tenant_id, name, description)
    SELECT gen_random_uuid(), t.id, 'Empleado',
           'Empleado de mostrador: pedidos, catálogo y clientes'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.roles
      WHERE tenant_id = t.id AND lower(name) = 'empleado' AND deleted_at IS NULL
    );
  END LOOP;
END
$$;

--> statement-breakpoint
-- 3a. Dueño → los 5 permisos tienda:*
INSERT INTO public.roles_to_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.tenant_id IS NOT NULL
  AND lower(r.name) = 'dueño'
  AND r.deleted_at IS NULL
  AND p.name LIKE 'tienda:%'
  AND p.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

--> statement-breakpoint
-- 3b. Empleado → pedidos + catálogo + clientes (SIN caja, SIN config)
INSERT INTO public.roles_to_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.tenant_id IS NOT NULL
  AND lower(r.name) = 'empleado'
  AND r.deleted_at IS NULL
  AND p.name IN ('tienda:pedidos:manage', 'tienda:catalogo:manage', 'tienda:clientes:manage')
  AND p.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

--> statement-breakpoint
-- 4. Backfill: usuarios existentes sin rol → Dueño
UPDATE public.users u
SET role_id = r.id
FROM public.roles r
WHERE r.tenant_id = u.tenant_id
  AND lower(r.name) = 'dueño'
  AND r.deleted_at IS NULL
  AND u.role_id IS NULL
  AND u.deleted_at IS NULL;

--> statement-breakpoint
-- 5. complete_client_activation: asigna rol Dueño al fundador que activa
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
  v_dueno_role_id uuid;
BEGIN
  IF p_password_hash IS NULL OR length(trim(p_password_hash)) = 0 THEN
    RAISE EXCEPTION 'password_hash no puede ser nulo o vacio';
  END IF;

  -- Rol Dueño del tenant (creado por esta migración; NULL si no existe)
  SELECT r.id INTO v_dueno_role_id
  FROM public.roles r
  WHERE r.tenant_id = p_tenant_id
    AND lower(r.name) = 'dueño'
    AND r.deleted_at IS NULL
  LIMIT 1;

  UPDATE public.clientes
  SET estado = 'activo', actualizado_en = now()
  WHERE id = p_client_id
    AND estado = 'onboarding'
    AND provisioned_tenant_id = p_tenant_id;

  GET DIAGNOSTICS v_client_updated = ROW_COUNT;
  IF v_client_updated <> 1 THEN
    RAISE EXCEPTION 'Precondicion fallida: cliente no encontrado en estado onboarding con tenant_id coincidente';
  END IF;

  UPDATE public.tenants
  SET status = 'active', updated_at = now()
  WHERE id = p_tenant_id
    AND status = 'pending_activation';

  GET DIAGNOSTICS v_tenant_updated = ROW_COUNT;
  IF v_tenant_updated <> 1 THEN
    RAISE EXCEPTION 'Precondicion fallida: tenant no encontrado en estado pending_activation';
  END IF;

  UPDATE public.users
  SET status = 'active',
      password_hash = p_password_hash,
      role_id = COALESCE(v_dueno_role_id, role_id),
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
REVOKE ALL PRIVILEGES
ON FUNCTION public.complete_client_activation(uuid, uuid, uuid, varchar)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.complete_client_activation(uuid, uuid, uuid, varchar)
TO api_user;

--> statement-breakpoint
-- 6. find_user_by_email: agrega role_name
-- OJO: cambia el RETURNS TABLE → PG NO permite CREATE OR REPLACE con
-- distinto tipo de retorno → DROP + CREATE (grants se re-aplican abajo).
DROP FUNCTION IF EXISTS public.find_user_by_email(varchar);

--> statement-breakpoint
CREATE FUNCTION public.find_user_by_email(p_email varchar)
RETURNS TABLE (
  user_id uuid,
  tenant_id uuid,
  password_hash varchar,
  user_status varchar,
  role_name varchar
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT u.id, u.tenant_id, u.password_hash, u.status,
         r.name AS role_name
  FROM public.users u
  LEFT JOIN public.roles r
    ON r.id = u.role_id AND r.deleted_at IS NULL
  WHERE lower(u.email) = lower(p_email)
    AND u.deleted_at IS NULL
  LIMIT 1;
$$;

--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.find_user_by_email(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(varchar) TO api_user;

COMMIT;

-- DOWN (rollback): restaurar find_user_by_email sin role_name (versión
-- 0010), restaurar complete_client_activation (versión 0010), limpiar
-- role_id de usuarios backfillados, borrar roles dueño/empleado por
-- tenant y permisos tienda:%.
