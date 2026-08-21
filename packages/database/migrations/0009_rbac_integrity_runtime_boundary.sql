-- ============================================================
-- 0009 — Integridad RBAC + frontera runtime
--
-- Converge la base viva y una reconstruccion desde 0000-0008:
--   * elimina solo duplicados exactos rol/permiso;
--   * agrega PK y unicidad de nombres de roles activos;
--   * cierra acceso directo de api_user/PUBLIC a RBAC y CRM;
--   * deja CRM reservado a nexora_admin hasta que 0010 cree
--     una funcion SECURITY DEFINER angosta para activacion.
-- ============================================================

BEGIN;

--> statement-breakpoint
DO $$
DECLARE
  duplicate_rows bigint;
BEGIN
  SELECT count(*) - count(DISTINCT (role_id, permission_id))
  INTO duplicate_rows
  FROM public.roles_to_permissions;

  RAISE NOTICE '0009: relaciones RBAC duplicadas exactas detectadas: %', duplicate_rows;
END
$$;

--> statement-breakpoint
WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY role_id, permission_id
      ORDER BY ctid
    ) AS duplicate_number
  FROM public.roles_to_permissions
)
DELETE FROM public.roles_to_permissions AS target
USING ranked
WHERE target.ctid = ranked.ctid
  AND ranked.duplicate_number > 1;

--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.roles_to_permissions
    GROUP BY role_id, permission_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '0009: quedaron relaciones RBAC duplicadas';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.roles
    WHERE tenant_id IS NULL AND deleted_at IS NULL
    GROUP BY lower(name)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '0009: existen nombres de roles globales activos duplicados';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.roles
    WHERE tenant_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY tenant_id, lower(name)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '0009: existen nombres de roles activos duplicados dentro de un tenant';
  END IF;
END
$$;

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.roles_to_permissions'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.roles_to_permissions
      ADD CONSTRAINT roles_to_permissions_pkey
      PRIMARY KEY (role_id, permission_id);
  END IF;
END
$$;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS roles_global_name_active_unique
  ON public.roles (lower(name))
  WHERE tenant_id IS NULL AND deleted_at IS NULL;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS roles_tenant_name_active_unique
  ON public.roles (tenant_id, lower(name))
  WHERE tenant_id IS NOT NULL AND deleted_at IS NULL;

--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE
  public.roles,
  public.permissions,
  public.roles_to_permissions,
  public.clientes
FROM api_user;

--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE
  public.roles,
  public.permissions,
  public.roles_to_permissions,
  public.clientes
FROM PUBLIC;

--> statement-breakpoint
DROP POLICY IF EXISTS clientes_nexora ON public.clientes;

--> statement-breakpoint
CREATE POLICY clientes_nexora ON public.clientes
  FOR ALL
  TO nexora_admin
  USING (true)
  WITH CHECK (true);

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.roles_to_permissions'::regclass
      AND contype = 'p'
  ) THEN
    RAISE EXCEPTION '0009: falta PK en roles_to_permissions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE grantee = 'api_user'
      AND table_schema = 'public'
      AND table_name IN ('roles', 'permissions', 'roles_to_permissions', 'clientes')
  ) THEN
    RAISE EXCEPTION '0009: api_user conserva grants directos sobre RBAC/CRM';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clientes'
      AND 'api_user' = ANY(roles)
  ) THEN
    RAISE EXCEPTION '0009: api_user permanece en policy de clientes';
  END IF;
END
$$;

--> statement-breakpoint
COMMIT;
