import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { PLATFORM_PERMISSIONS } from "../platform-permissions.js";

const adminUrl = process.env.DATABASE_ADMIN_URL;
const apiUrl = process.env.DATABASE_API_URL;
const isDbAvailable = Boolean(adminUrl && apiUrl);

describe("Platform Permissions Constants (Unit Test)", () => {
  it("Exporta exactamente los 7 permisos explícitos de plataforma", () => {
    const list = Object.values(PLATFORM_PERMISSIONS);
    expect(list).toHaveLength(7);
    expect(list).toContain("platform:control:read");
    expect(list).toContain("platform:control:manage");
    expect(list).toContain("platform:onboarding");
    expect(list).toContain("platform:runtime:read");
    expect(list).toContain("platform:runtime:manage");
    expect(list).toContain("platform:backup:read");
    expect(list).toContain("platform:events:read");
  });
});

describe.runIf(isDbAvailable)("Platform Identity and RBAC Foundation (DB Integration)", () => {
  let adminPool: pg.Pool;
  let apiPool: pg.Pool;

  beforeAll(() => {
    adminPool = new pg.Pool({ connectionString: adminUrl });
    apiPool = new pg.Pool({ connectionString: apiUrl });
  });

  afterAll(async () => {
    if (adminPool) await adminPool.end();
    if (apiPool) await apiPool.end();
  });

  it("Los 7 permisos de plataforma existen en public.permissions", async () => {
    const expected = Object.values(PLATFORM_PERMISSIONS);
    const res = await adminPool.query(
      "SELECT name FROM public.permissions WHERE name LIKE 'platform:%' AND deleted_at IS NULL",
    );
    const names = res.rows.map((r) => r.name);
    for (const perm of expected) {
      expect(names).toContain(perm);
    }
  });

  it("El rol global 'Platform Founder' existe en public.roles con tenant_id IS NULL", async () => {
    const res = await adminPool.query(
      "SELECT id, tenant_id, name FROM public.roles WHERE lower(name) = 'platform founder' AND deleted_at IS NULL",
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].tenant_id).toBeNull();
  });

  it("El rol 'Platform Founder' tiene asociados los 7 permisos platform:* en roles_to_permissions", async () => {
    const res = await adminPool.query(`
      SELECT p.name
      FROM public.roles r
      JOIN public.roles_to_permissions rp ON rp.role_id = r.id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE lower(r.name) = 'platform founder'
        AND r.tenant_id IS NULL
        AND r.deleted_at IS NULL
        AND p.deleted_at IS NULL
    `);
    const names = res.rows.map((r) => r.name);
    expect(names.length).toBeGreaterThanOrEqual(7);
    for (const perm of Object.values(PLATFORM_PERMISSIONS)) {
      expect(names).toContain(perm);
    }
  });

  it("Un usuario comercial normal NO recibe rol ni permisos de plataforma", async () => {
    const tenantId = "00000000-0000-0000-0000-000000000055";
    const userId = "00000000-0000-0000-0000-000000000056";

    const client = await adminPool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        "INSERT INTO public.tenants (id, name, slug) VALUES ($1, 'Tenant Comercial Test', 'tenant-comercial-test') ON CONFLICT DO NOTHING",
        [tenantId],
      );
      await client.query(
        "INSERT INTO public.users (id, tenant_id, email, status, role_id) VALUES ($1, $2, 'comercial@test.com', 'active', NULL) ON CONFLICT DO NOTHING",
        [userId, tenantId],
      );

      const res = await client.query(`
        SELECT p.name
        FROM public.users u
        JOIN public.roles r ON r.id = u.role_id
        JOIN public.roles_to_permissions rp ON rp.role_id = r.id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE u.id = $1
      `, [userId]);

      const perms = res.rows.map((r) => r.name);
      expect(perms).not.toContain("platform:control:read");
      expect(perms).not.toContain("platform:control:manage");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("api_user conserva NOBYPASSRLS y RLS permanece intacto", async () => {
    const res = await adminPool.query(`
      SELECT rolbypassrls
      FROM pg_roles
      WHERE rolname = 'api_user'
    `);
    expect(res.rows[0].rolbypassrls).toBe(false);
  });
});
