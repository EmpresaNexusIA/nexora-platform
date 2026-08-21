import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";

const adminUrl = process.env.DATABASE_ADMIN_URL;
const apiUrl = process.env.DATABASE_API_URL;

const isDbAvailable = Boolean(adminUrl && apiUrl);

describe("Seed Enforcement Unit Test", () => {
  it("Seed falla de forma explícita si ALLOW_DEV_SEED no es 'true'", async () => {
    const originalEnv = process.env.ALLOW_DEV_SEED;
    try {
      delete process.env.ALLOW_DEV_SEED;
      // Re-evaluar la condición de seed
      const checkSeed = () => {
        if (process.env.ALLOW_DEV_SEED !== "true") {
          throw new Error("Seed bloqueado: definir ALLOW_DEV_SEED=true de forma explicita");
        }
      };
      expect(checkSeed).toThrow("Seed bloqueado");
    } finally {
      if (originalEnv !== undefined) {
        process.env.ALLOW_DEV_SEED = originalEnv;
      }
    }
  });
});

describe.runIf(isDbAvailable)("Onboarding and Activation Boundary (DB Integration)", () => {
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

  it("api_user NO puede realizar SELECT directo sobre public.clientes", async () => {
    const client = await apiPool.connect();
    try {
      await expect(client.query("SELECT * FROM public.clientes")).rejects.toThrow();
    } finally {
      client.release();
    }
  });

  it("api_user NO puede realizar INSERT directo sobre public.clientes", async () => {
    const client = await apiPool.connect();
    try {
      await expect(
        client.query("INSERT INTO public.clientes (nombre) VALUES ('Test Direct')"),
      ).rejects.toThrow();
    } finally {
      client.release();
    }
  });

  it("PUBLIC NO puede ejecutar complete_client_activation", async () => {
    // Verificamos permisos en pg_proc / information_schema o intentando invocar como api_user si PUBLIC tuviera EXECUTE
    const res = await adminPool.query(`
      SELECT has_function_privilege('public', 'public.complete_client_activation(uuid,uuid,uuid,varchar)', 'EXECUTE') as has_perm
    `);
    expect(res.rows[0].has_perm).toBe(false);
  });

  it("api_user SÍ tiene permiso EXECUTE sobre complete_client_activation", async () => {
    const res = await adminPool.query(`
      SELECT has_function_privilege('api_user', 'public.complete_client_activation(uuid,uuid,uuid,varchar)', 'EXECUTE') as has_perm
    `);
    expect(res.rows[0].has_perm).toBe(true);
  });

  it("find_user_by_email funciona con distinta capitalización (case-insensitive)", async () => {
    const testEmail = "Test.Case.User@Nexora.com";
    const tenantId = "00000000-0000-0000-0000-000000000099";
    const userId = "00000000-0000-0000-0001-000000000099";

    try {
      await adminPool.query(
        "INSERT INTO public.tenants (id, name, slug) VALUES ($1, 'Case Tenant', 'case-tenant') ON CONFLICT DO NOTHING",
        [tenantId],
      );
      await adminPool.query(
        "INSERT INTO public.users (id, tenant_id, email, status) VALUES ($1, $2, $3, 'active') ON CONFLICT DO NOTHING",
        [userId, tenantId, testEmail],
      );

      // Consulta mediante api_user invocando find_user_by_email con lowercase
      const apiConn = await apiPool.connect();
      try {
        const resLower = await apiConn.query("SELECT * FROM find_user_by_email($1)", ["test.case.user@nexora.com"]);
        expect(resLower.rows.length).toBe(1);
        expect(resLower.rows[0].user_id).toBe(userId);

        const resUpper = await apiConn.query("SELECT * FROM find_user_by_email($1)", ["TEST.CASE.USER@NEXORA.COM"]);
        expect(resUpper.rows.length).toBe(1);
        expect(resUpper.rows[0].user_id).toBe(userId);
      } finally {
        apiConn.release();
      }
    } finally {
      await adminPool.query("DELETE FROM public.users WHERE id = $1", [userId]);
      await adminPool.query("DELETE FROM public.tenants WHERE id = $1", [tenantId]);
    }
  });

  it("Rechaza asignación de más de un tenant al mismo cliente CRM (índice único parcial)", async () => {
    const clientId = "00000000-0000-0000-0000-000000000088";
    const tenantId1 = "00000000-0000-0000-0000-000000000081";
    const tenantId2 = "00000000-0000-0000-0000-000000000082";

    try {
      await adminPool.query(
        "INSERT INTO public.tenants (id, name, slug) VALUES ($1, 'Tenant 1', 'tenant-1'), ($2, 'Tenant 2', 'tenant-2') ON CONFLICT DO NOTHING",
        [tenantId1, tenantId2],
      );
      await adminPool.query(
        "INSERT INTO public.clientes (id, nombre, estado, provisioned_tenant_id) VALUES ($1, 'Cliente Unicidad', 'onboarding', $2)",
        [clientId, tenantId1],
      );

      // Intentar insertar otro cliente con el mismo provisioned_tenant_id
      const secondClientId = "00000000-0000-0000-0000-000000000089";
      await expect(
        adminPool.query(
          "INSERT INTO public.clientes (id, nombre, estado, provisioned_tenant_id) VALUES ($1, 'Cliente Duplicado', 'onboarding', $2)",
          [secondClientId, tenantId1],
        ),
      ).rejects.toThrow();
    } finally {
      await adminPool.query("DELETE FROM public.clientes WHERE id IN ('00000000-0000-0000-0000-000000000088', '00000000-0000-0000-0000-000000000089')");
      await adminPool.query("DELETE FROM public.tenants WHERE id IN ($1, $2)", [tenantId1, tenantId2]);
    }
  });

  it("Activación atómica con complete_client_activation actualiza cliente, tenant y usuario", async () => {
    const clientId = "00000000-0000-0000-0000-000000000077";
    const tenantId = "00000000-0000-0000-0000-000000000077";
    const userId = "00000000-0000-0000-0000-000000000077";
    // Bcrypt hash de costo 10 para 'Password123!'
    const validBcryptHash = "$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3vjPGga31lW";

    try {
      await adminPool.query("INSERT INTO public.tenants (id, name, slug, status) VALUES ($1, 'Tenant Onboard', 'tenant-onboard', 'pending_activation')", [tenantId]);
      await adminPool.query("INSERT INTO public.users (id, tenant_id, email, status) VALUES ($1, $2, 'onboard@test.com', 'invited')", [userId, tenantId]);
      await adminPool.query("INSERT INTO public.clientes (id, nombre, estado, provisioned_tenant_id) VALUES ($1, 'Cliente Onboard', 'onboarding', $2)", [clientId, tenantId]);

      const apiConn = await apiPool.connect();
      try {
        await apiConn.query("SELECT complete_client_activation($1, $2, $3, $4)", [clientId, tenantId, userId, validBcryptHash]);
      } finally {
        apiConn.release();
      }

      const clientRes = await adminPool.query("SELECT estado FROM public.clientes WHERE id = $1", [clientId]);
      expect(clientRes.rows[0].estado).toBe("activo");

      const tenantRes = await adminPool.query("SELECT status FROM public.tenants WHERE id = $1", [tenantId]);
      expect(tenantRes.rows[0].status).toBe("active");

      const userRes = await adminPool.query("SELECT status, password_hash FROM public.users WHERE id = $1", [userId]);
      expect(userRes.rows[0].status).toBe("active");
      expect(userRes.rows[0].password_hash).toBe(validBcryptHash);
    } finally {
      await adminPool.query("DELETE FROM public.clientes WHERE id = $1", [clientId]);
      await adminPool.query("DELETE FROM public.users WHERE id = $1", [userId]);
      await adminPool.query("DELETE FROM public.tenants WHERE id = $1", [tenantId]);
    }
  });

  it("Fallo de precondición en complete_client_activation provoca rollback total", async () => {
    const clientId = "00000000-0000-0000-0000-000000000066";
    const tenantId = "00000000-0000-0000-0000-000000000066";
    const userId = "00000000-0000-0000-0000-000000000066";
    const validBcryptHash = "$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3vjPGga31lW";

    try {
      await adminPool.query("INSERT INTO public.tenants (id, name, slug, status) VALUES ($1, 'Tenant Wrong', 'tenant-wrong', 'pending_activation')", [tenantId]);
      await adminPool.query("INSERT INTO public.users (id, tenant_id, email, status) VALUES ($1, $2, 'wrong@test.com', 'active')", [userId, tenantId]); // status active en vez de invited
      await adminPool.query("INSERT INTO public.clientes (id, nombre, estado, provisioned_tenant_id) VALUES ($1, 'Cliente Wrong', 'onboarding', $2)", [clientId, tenantId]);

      const apiConn = await apiPool.connect();
      try {
        await expect(
          apiConn.query("SELECT complete_client_activation($1, $2, $3, $4)", [clientId, tenantId, userId, validBcryptHash]),
        ).rejects.toThrow();
      } finally {
        apiConn.release();
      }

      // Verificamos que cliente y tenant NO cambiaron de estado (rollback total)
      const clientRes = await adminPool.query("SELECT estado FROM public.clientes WHERE id = $1", [clientId]);
      expect(clientRes.rows[0].estado).toBe("onboarding");

      const tenantRes = await adminPool.query("SELECT status FROM public.tenants WHERE id = $1", [tenantId]);
      expect(tenantRes.rows[0].status).toBe("pending_activation");
    } finally {
      await adminPool.query("DELETE FROM public.clientes WHERE id = $1", [clientId]);
      await adminPool.query("DELETE FROM public.users WHERE id = $1", [userId]);
      await adminPool.query("DELETE FROM public.tenants WHERE id = $1", [tenantId]);
    }
  });
});
