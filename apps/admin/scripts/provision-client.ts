import "dotenv/config";
import crypto from "node:crypto";
import { Command } from "commander";
import { Redis } from "ioredis";
import { pool } from "@nexora/database";

// Utility token function for admin script
async function createActivationToken(
  redis: Redis,
  payload: { clientId: string; tenantId: string; userId: string },
): Promise<{ token: string; hash: string }> {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const existingHashKey = `user_activation:${payload.userId}`;
  const existingHash = await redis.get(existingHashKey);
  if (existingHash) {
    await redis.del(`activation_token:${existingHash}`);
  }

  const tokenPayload = {
    clientId: payload.clientId,
    tenantId: payload.tenantId,
    userId: payload.userId,
    purpose: "account_activation",
    createdAt: new Date().toISOString(),
  };

  const ttlSeconds = 48 * 60 * 60; // 48 horas
  await redis.set(`activation_token:${hash}`, JSON.stringify(tokenPayload), "EX", ttlSeconds);
  await redis.set(existingHashKey, hash, "EX", ttlSeconds);

  return { token: rawToken, hash };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const program = new Command();

program
  .name("provision-client")
  .description("Herramienta administrativa de aprovisionamiento asistido para onboarding")
  .requiredOption("--client-id <uuid>", "ID del cliente CRM (UUID)")
  .requiredOption("--tenant-name <name>", "Nombre de la empresa / tenant")
  .requiredOption("--tenant-slug <slug>", "Slug único para el tenant")
  .requiredOption("--user-email <email>", "Email del usuario fundador del tenant")
  .option("--user-name <name>", "Nombre del usuario fundador")
  .option("--actor <actor>", "Identificador del operador/actor", "admin_founder")
  .action(async (options) => {
    const { clientId, tenantName, tenantSlug, userEmail, userName, actor } = options;

    if (!UUID_REGEX.test(clientId)) {
      console.error("ERROR: --client-id debe ser un UUID válido");
      process.exit(1);
    }

    const normalizedEmail = userEmail.trim().toLowerCase();
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 });

    // Rate-limit script execution per clientId (prevenir doble ejecución)
    const lockKey = `lock:provision:${clientId}`;
    const acquired = await redis.set(lockKey, "1", "EX", 60, "NX");
    if (!acquired) {
      console.error("ERROR: Operación de aprovisionamiento en progreso o ejecutada recientemente para este cliente.");
      redis.disconnect();
      process.exit(1);
    }

    const dbClient = await pool.connect();

    try {
      await dbClient.query("BEGIN");

      // 1. Verificar cliente en estado 'vendido'
      const clientRes = await dbClient.query(
        "SELECT id, nombre, estado, provisioned_tenant_id FROM public.clientes WHERE id = $1 FOR UPDATE",
        [clientId],
      );

      if (clientRes.rows.length === 0) {
        throw new Error(`Cliente CRM no encontrado: ${clientId}`);
      }

      const clientRow = clientRes.rows[0];
      if (clientRow.estado !== "vendido") {
        throw new Error(`Cliente debe estar en estado 'vendido'. Estado actual: '${clientRow.estado}'`);
      }

      if (clientRow.provisioned_tenant_id) {
        throw new Error(`El cliente ya tiene un tenant asignado: ${clientRow.provisioned_tenant_id}`);
      }

      // 2. Crear tenant con status 'pending_activation'
      const tenantRes = await dbClient.query(
        "INSERT INTO public.tenants (name, slug, status) VALUES ($1, $2, 'pending_activation') RETURNING id",
        [tenantName, tenantSlug],
      );
      const tenantId = tenantRes.rows[0].id;

      // 3. Crear usuario admin del tenant con status 'invited' y sin password
      const userRes = await dbClient.query(
        "INSERT INTO public.users (tenant_id, email, name, status, password_hash) VALUES ($1, $2, $3, 'invited', NULL) RETURNING id",
        [tenantId, normalizedEmail, userName || tenantName],
      );
      const userId = userRes.rows[0].id;

      // 4. Vincular cliente CRM con tenant y actualizar estado a 'onboarding'
      await dbClient.query(
        "UPDATE public.clientes SET estado = 'onboarding', provisioned_tenant_id = $1, actualizado_en = now() WHERE id = $2",
        [tenantId, clientId],
      );

      await dbClient.query("COMMIT");

      // 5. Generar token de activación en Redis post-commit
      const { token } = await createActivationToken(redis, {
        clientId,
        tenantId,
        userId,
      });

      // 6. Auditoría estructurada JSON a stdout
      const auditLog = {
        event_type: "client_provisioned",
        actor,
        client_id: clientId,
        tenant_id: tenantId,
        user_id: userId,
        timestamp: new Date().toISOString(),
      };

      console.log(JSON.stringify(auditLog));

      const domain = process.env.COOKIE_DOMAIN || "nexora.localhost";
      const activationUrl = `https://panel.${domain}/activar?token=${token}`;

      console.log("\n=======================================================");
      console.log(" APROVISIONAMIENTO EXITOSO");
      console.log("=======================================================");
      console.log(`Tenant ID:       ${tenantId}`);
      console.log(`User ID:         ${userId}`);
      console.log(`User Email:      ${normalizedEmail}`);
      console.log(`Activation Link: ${activationUrl}`);
      console.log("=======================================================\n");

      redis.disconnect();
      dbClient.release();
      process.exit(0);
    } catch (err: any) {
      await dbClient.query("ROLLBACK").catch(() => {});
      await redis.del(lockKey).catch(() => {});
      redis.disconnect();
      dbClient.release();
      console.error(`ERROR DE APROVISIONAMIENTO: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
