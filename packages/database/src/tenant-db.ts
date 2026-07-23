import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { getTenantId } from "@nexora/context";
import { pool } from "./client.js";

export async function withTenantDatabase<T>(
  callback: (db: NodePgDatabase) => Promise<T>
): Promise<T> {
  const tenantId = getTenantId();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_tenant_id', $1, true)",
      [tenantId]
    );

    const db = drizzle(client) as NodePgDatabase;
    const result = await callback(db);

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
