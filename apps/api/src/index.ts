import "dotenv/config";
import crypto from "node:crypto";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { redis } from "./lib/redis.js";
import { signAccessToken, signRefreshToken, verifyToken } from "./lib/jwt.js";
import { checkReadiness } from "./lib/readiness.js";
import { consumeActivationToken } from "./lib/activation-token.js";
import { authPlugin } from "./plugins/auth.js";
import { tenantPlugin } from "./plugins/tenant.js";
import { pool } from "@nexora/database";
import { sql } from "drizzle-orm";

// ============================================================
//  Nexora API — Server principal
//  ADR-0009: api_user + RS256 + tenant wrapper + rate limit
// ============================================================

const app = Fastify({
  logger: config.isDev,
}).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// --- Plugins de infraestructura ---
await app.register(cookie, {});
await app.register(cors, {
  origin: config.isDev ? true : [`https://panel.${config.cookie.domain}`],
  credentials: true,
});
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis: redis,
});

// --- Plugins de dominio ---
// Se aplican sobre la instancia raíz para que hooks y decoradores
// alcancen obligatoriamente a todas las rutas declaradas debajo.
await authPlugin(app);
await tenantPlugin(app);

// Delay anti-timing para prevenir timing attacks en rutas sensibles
const antiTimingDelay = () => new Promise((resolve) => setTimeout(resolve, 200));

// --- Compatibilidad: /health conserva la respuesta historica ---
app.get("/health", { config: { rateLimit: false } }, async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// --- Liveness: Fastify esta ejecutando el event loop ---
app.get("/health/live", { config: { rateLimit: false } }, async () => {
  return { status: "alive", timestamp: new Date().toISOString() };
});

// --- Readiness: la API puede trabajar con sus dependencias criticas ---
app.get("/health/ready", { config: { rateLimit: false } }, async (_request, reply) => {
  const result = await checkReadiness();

  if (!result.ready) {
    app.log.warn(
      { checks: result.checks },
      "Nexora API no esta lista para recibir trafico",
    );
  }

  return reply.code(result.ready ? 200 : 503).send({
    status: result.ready ? "ready" : "not_ready",
    checks: result.checks,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
//  POST /login — Autenticación
// ============================================================
const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type LoginBody = z.infer<typeof loginBodySchema>;

app.post(
  "/login",
  {
    schema: {
      body: loginBodySchema,
    },
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  },
  async (request, reply) => {
    const { email, password } = request.body as LoginBody;
    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      "SELECT * FROM find_user_by_email($1)",
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      return reply.code(401).send({ error: "Credenciales inválidas" });
    }

    const user = result.rows[0] as {
      user_id: string;
      tenant_id: string;
      password_hash: string | null;
      user_status: string;
    };

    if (!user.password_hash) {
      return reply.code(401).send({ error: "Credenciales inválidas" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: "Credenciales inválidas" });
    }

    if (user.user_status !== "active") {
      return reply.code(403).send({ error: "Usuario inactivo" });
    }

    const accessToken = await signAccessToken(user.user_id, user.tenant_id);
    const refreshToken = await signRefreshToken(user.user_id, user.tenant_id);

    const refreshKey = `refresh:${user.user_id}`;
    await redis.set(refreshKey, refreshToken, "EX", 7 * 24 * 60 * 60);

    app.log.info(`Login OK: ${normalizedEmail} (tenant: ${user.tenant_id})`);

    reply.setCookie("access_token", accessToken, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: "lax",
      path: "/",
      domain: config.cookie.domain,
    });

    reply.setCookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: "lax",
      path: "/",
      domain: config.cookie.domain,
    });

    return { accessToken, tenantId: user.tenant_id };
  },
);

// ============================================================
//  POST /onboarding/activate — Endpoint público de activación
// ============================================================
const onboardingActivateSchema = z.object({
  token: z.string().min(1, "Token es requerido"),
  password: z
    .string()
    .min(12, "Mínimo 12 caracteres")
    .regex(/[A-Z]/, "Al menos una mayúscula")
    .regex(/[a-z]/, "Al menos una minúscula")
    .regex(/[0-9]/, "Al menos un número")
    .regex(/[^A-Za-z0-9]/, "Al menos un símbolo"),
});

type OnboardingActivateBody = z.infer<typeof onboardingActivateSchema>;

app.post(
  "/onboarding/activate",
  {
    schema: {
      body: onboardingActivateSchema,
    },
    // Rate limiting por IP: 3 intentos cada 15 minutos
    config: { rateLimit: { max: 3, timeWindow: "15 minutes" } },
  },
  async (request, reply) => {
    const { token, password } = request.body as OnboardingActivateBody;

    // Rate limiting adicional por token (1 intento cada 5 minutos por token hash)
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const tokenRateLimitKey = `rate_limit_activate_token:${tokenHash}`;

    const acquiredLock = await redis.set(tokenRateLimitKey, "1", "EX", 300, "NX");
    if (!acquiredLock) {
      await antiTimingDelay();
      return reply.code(400).send({ error: "Invitación inválida o expirada" });
    }

    // Consumo atómico del token en Redis
    const tokenPayload = await consumeActivationToken(redis, token);
    if (!tokenPayload) {
      await antiTimingDelay();
      return reply.code(400).send({ error: "Invitación inválida o expirada" });
    }

    // Generación de bcrypt cost 10
    const passwordHash = await bcrypt.hash(password, 10);

    try {
      // Ejecución de la función angosta SECURITY DEFINER
      await pool.query(
        "SELECT complete_client_activation($1, $2, $3, $4)",
        [
          tokenPayload.clientId,
          tokenPayload.tenantId,
          tokenPayload.userId,
          passwordHash,
        ],
      );
    } catch (dbErr) {
      app.log.error(
        { err: dbErr, payload: tokenPayload },
        "CRITICAL: Fallo en DB durante activación post-consumo de token Redis. Se requiere nueva invitación.",
      );
      await antiTimingDelay();
      return reply.code(400).send({ error: "Invitación inválida o expirada" });
    }

    // Registro estructurado de auditoría
    app.log.info(
      {
        event_type: "activation_completed",
        actor: "system_onboarding",
        client_id: tokenPayload.clientId,
        tenant_id: tokenPayload.tenantId,
        user_id: tokenPayload.userId,
        timestamp: new Date().toISOString(),
      },
      "Activación de onboarding completada exitosamente",
    );

    await antiTimingDelay();
    return { ok: true, message: "Cuenta activada exitosamente" };
  },
);

// ============================================================
//  POST /refresh — Renovar access token
// ============================================================
app.post("/refresh", async (request, reply) => {
  const refreshToken = request.cookies?.refresh_token;
  if (!refreshToken) {
    return reply.code(401).send({ error: "No hay refresh token" });
  }

  try {
    const payload = await verifyToken(refreshToken);
    if (payload.type !== "refresh") {
      return reply.code(401).send({ error: "Token inválido" });
    }

    const stored = await redis.get(`refresh:${payload.sub}`);
    if (stored !== refreshToken) {
      return reply.code(401).send({ error: "Sesión revocada" });
    }

    const accessToken = await signAccessToken(payload.sub, payload.tenantId!);

    reply.setCookie("access_token", accessToken, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: "lax",
      path: "/",
      domain: config.cookie.domain,
    });

    return { accessToken };
  } catch {
    return reply.code(401).send({ error: "Refresh token inválido" });
  }
});

// ============================================================
//  POST /logout — Revocar refresh token
// ============================================================
app.post("/logout", async (request, reply) => {
  const refreshToken = request.cookies?.refresh_token;
  if (refreshToken) {
    try {
      const payload = await verifyToken(refreshToken);
      await redis.del(`refresh:${payload.sub}`);
    } catch {
      // Token inválido — igual limpiamos cookies
    }
  }

  reply.clearCookie("access_token", { path: "/" });
  reply.clearCookie("refresh_token", { path: "/" });
  return { ok: true };
});

// ============================================================
//  GET /me — Ruta protegida (demuestra el wrapper de tenant)
// ============================================================
app.get(
  "/me",
  { config: { required: true, withTenant: true } },
  async (request, reply) => {
  if (!request.userId || !request.tenantId) {
    return reply.code(401).send({ error: "No autenticado" });
  }

  const userInfo = await app.withTenant(request, async (db) => {
    const result = await db.execute(sql`
      SELECT id, email, name, status
      FROM users
      WHERE id = ${request.userId}
    `);
    return result.rows[0];
  });

  if (!userInfo) {
    return reply.code(404).send({ error: "Usuario no encontrado" });
  }

  return userInfo;
});

// ============================================================
//  GET /tenants/me — Datos del tenant del usuario
// ============================================================
app.get(
  "/tenants/me",
  { config: { required: true, withTenant: true } },
  async (request, reply) => {
  if (!request.tenantId) {
    return reply.code(401).send({ error: "No autenticado" });
  }

  const tenant = await app.withTenant(request, async (db) => {
    const result = await db.execute(sql`
      SELECT id, name, slug, status
      FROM tenants
      WHERE id = ${request.tenantId}
    `);
    return result.rows[0];
  });

  if (!tenant) {
    return reply.code(404).send({ error: "Tenant no encontrado" });
  }

  return tenant;
});

// ============================================================
//  Startup
// ============================================================
app.listen({ port: config.port, host: config.host }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Nexora API escuchando en ${address}`);
  app.log.info(`  Rol: api_user (NOBYPASSRLS) | Auth: RS256 | Redis: refresh+ratelimit`);
});
