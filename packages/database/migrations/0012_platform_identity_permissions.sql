-- ============================================================
-- Migración 0012 — Infraestructura de Permisos de Plataforma y Rol Platform Founder
--
--  1. Registra la matriz explícita de permisos platform:* en public.permissions.
--  2. Crea el rol global Platform Founder (tenant_id IS NULL) en public.roles.
--  3. Vincula el rol Platform Founder con todos los permisos platform:* en public.roles_to_permissions.
--  4. NO asigna automáticamente el rol a ningún usuario; la asignación se realiza
--     de forma reproducible mediante el proceso de bootstrap (create-admin.sh).
-- ============================================================

BEGIN;

--> statement-breakpoint
-- 1. Insertar permisos explícitos de plataforma
INSERT INTO public.permissions (id, name, description) VALUES
  (gen_random_uuid(), 'platform:control:read', 'Lectura del panel de control y resumen general de la plataforma'),
  (gen_random_uuid(), 'platform:control:manage', 'Configuración operativa del panel de control'),
  (gen_random_uuid(), 'platform:onboarding', 'Lectura y monitoreo del proceso de onboarding de clientes'),
  (gen_random_uuid(), 'platform:runtime:read', 'Lectura del estado de salud de contenedores y servicios del organismo'),
  (gen_random_uuid(), 'platform:runtime:manage', 'Gestión y control operativo de runtime de infraestructura'),
  (gen_random_uuid(), 'platform:backup:read', 'Lectura y verificación de respaldos y restauraciones'),
  (gen_random_uuid(), 'platform:events:read', 'Lectura de eventos outbox y autopsias de la DLQ')
ON CONFLICT (name) DO NOTHING;

--> statement-breakpoint
-- 2. Crear rol global Platform Founder (tenant_id IS NULL)
INSERT INTO public.roles (id, tenant_id, name, description)
SELECT
  gen_random_uuid(),
  NULL,
  'Platform Founder',
  'Rol global de fundador de la plataforma con acceso a funciones de supervisión y control'
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles
  WHERE tenant_id IS NULL
    AND lower(name) = 'platform founder'
    AND deleted_at IS NULL
);

--> statement-breakpoint
-- 3. Vincular permisos de plataforma al rol global Platform Founder
INSERT INTO public.roles_to_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.tenant_id IS NULL
  AND lower(r.name) = 'platform founder'
  AND r.deleted_at IS NULL
  AND p.name LIKE 'platform:%'
  AND p.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;

-- ============================================================
-- DOWN MIGRATION (ROLLBACK):
--
-- DELETE FROM public.roles_to_permissions
-- WHERE role_id IN (
--   SELECT id FROM public.roles
--   WHERE tenant_id IS NULL AND lower(name) = 'platform founder'
-- );
--
-- DELETE FROM public.roles
-- WHERE tenant_id IS NULL AND lower(name) = 'platform founder';
--
-- DELETE FROM public.permissions
-- WHERE name LIKE 'platform:%';
-- ============================================================
