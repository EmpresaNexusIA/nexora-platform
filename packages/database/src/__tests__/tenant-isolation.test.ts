import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";

const TENANT_A = "00000000-0000-0000-0000-000000000001";
const TENANT_B = "00000000-0000-0000-0000-000000000002";

function requiredEnv(key: "DATABASE_ADMIN_URL" | "DATABASE_API_URL"): string {
  const value = process.env[key];
  if (!value) throw new Error(`Falta ${key} para tenant-isolation.test.ts`);
  return value;
}

// Pool admin para setup/teardown controlado.
const adminPool = new pg.Pool({
  connectionString: requiredEnv("DATABASE_ADMIN_URL"),
});

// Pool runtime api_user, sujeto a RLS.
const appPool = new pg.Pool({
  connectionString: requiredEnv("DATABASE_API_URL"),
});

beforeAll(async () => {
  await adminPool.query(`
    INSERT INTO tenants (id, name, slug) VALUES
    ('${TENANT_A}', 'Tenant A', 'tenant-a'),
    ('${TENANT_B}', 'Tenant B', 'tenant-b')
    ON CONFLICT DO NOTHING
  `);
  await adminPool.query(`
    INSERT INTO users (id, tenant_id, email) VALUES
    ('00000000-0000-0000-0001-000000000001', '${TENANT_A}', 'user@tenant-a.com'),
    ('00000000-0000-0000-0002-000000000001', '${TENANT_B}', 'user@tenant-b.com')
    ON CONFLICT DO NOTHING
  `);
});

afterAll(async () => {
  await adminPool.query("DELETE FROM users WHERE email IN ('user@tenant-a.com', 'user@tenant-b.com')");
  await adminPool.query("DELETE FROM tenants WHERE id IN ('${TENANT_A}', '${TENANT_B}')");
  await adminPool.end();
  await appPool.end();
});

describe("Tenant Isolation", () => {
  it("Tenant A solo ve sus propios usuarios", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [TENANT_A]);
      const result = await client.query("SELECT * FROM users");
      await client.query("COMMIT");
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].email).toBe("user@tenant-a.com");
    } finally {
      client.release();
    }
  });

  it("Tenant B no puede ver datos de Tenant A", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [TENANT_B]);
      const result = await client.query("SELECT * FROM users WHERE email = 'user@tenant-a.com'");
      await client.query("COMMIT");
      expect(result.rows.length).toBe(0);
    } finally {
      client.release();
    }
  });
});
