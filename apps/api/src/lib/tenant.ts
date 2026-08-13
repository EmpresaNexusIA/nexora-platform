import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { pool } from "@nexora/database";
import { runWithContext, type NexoraContext } from "@nexora/context";

export async function withTenant<T>(
  tenantId: string,
  userId: string,
  callback: (db: NodePgDatabase) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);

    const db = drizzle(client) as NodePgDatabase;

    const context: NexoraContext = {
      tenantId,
      traceId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      executionType: "http",
    };

    const result = await runWithContext(context, () => callback(db));

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
