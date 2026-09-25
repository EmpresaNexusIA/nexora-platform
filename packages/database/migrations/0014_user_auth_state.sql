-- ============================================================
-- 0014 — Estado de autenticación en vivo (fix de seguridad P1)
--
--  1. Función angosta public.get_user_auth_state(p_user_id):
--     devuelve (user_status, role_name) actuales de la base.
--     /refresh la consulta para NO congelar el rol 7 días en el
--     payload JWT y para bloquear la renovación de usuarios
--     suspendidos/inactivos (patrón 0006/0007/0010: STABLE,
--     search_path fijo, REVOKE de PUBLIC, GRANT a api_user).
--
--  2. Trigger AFTER INSERT ON public.tenants: crea automáticamente
--     los roles Dueño y Empleado del tenant nuevo y vincula los
--     permisos tienda:* (Dueño=5, Empleado=3). Cierra la fuente de
--     role_id=NULL en tenants creados por provision-client después
--     de 0013 (que solo backfilló los existentes).
--
--  Idempotente (CREATE OR REPLACE / DROP TRIGGER IF EXISTS).
-- ============================================================

BEGIN;

--> statement-breakpoint
-- 1. Estado de autenticación en vivo (angosta: 2 columnas, 1 fila)
CREATE OR REPLACE FUNCTION public.get_user_auth_state(p_user_id uuid)
RETURNS TABLE (
  user_status varchar,
  role_name varchar
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT u.status, r.name
  FROM public.users u
  LEFT JOIN public.roles r
    ON r.id = u.role_id AND r.deleted_at IS NULL
  WHERE u.id = p_user_id
    AND u.deleted_at IS NULL
  LIMIT 1;
$$;

--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.get_user_auth_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_auth_state(uuid) TO api_user;

--> statement-breakpoint
-- 2. Roles de tienda para tenants nuevos (misma lógica que 0013 §2+§3)
CREATE OR REPLACE FUNCTION public.provision_tienda_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.roles (id, tenant_id, name, description) VALUES
    (gen_random_uuid(), NEW.id, 'Dueño',
     'Dueño del comercio con acceso completo al panel'),
    (gen_random_uuid(), NEW.id, 'Empleado',
     'Empleado de mostrador: pedidos, catálogo y clientes');

  INSERT INTO public.roles_to_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM public.roles r
  CROSS JOIN public.permissions p
  WHERE r.tenant_id = NEW.id
    AND r.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND (
      (r.name = 'Dueño' AND p.name LIKE 'tienda:%')
      OR (r.name = 'Empleado' AND p.name IN
          ('tienda:pedidos:manage', 'tienda:catalogo:manage', 'tienda:clientes:manage'))
    )
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  RETURN NEW;
END;
$$;

--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.provision_tienda_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_tienda_roles() TO api_user;

--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_tenant_new_tienda_roles ON public.tenants;

--> statement-breakpoint
CREATE TRIGGER trg_tenant_new_tienda_roles
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.provision_tienda_roles();

COMMIT;

-- ============================================================
-- DOWN (ROLLBACK):
-- DROP TRIGGER IF EXISTS trg_tenant_new_tienda_roles ON public.tenants;
-- DROP FUNCTION IF EXISTS public.provision_tienda_roles();
-- DROP FUNCTION IF EXISTS public.get_user_auth_state(uuid);
-- ============================================================
