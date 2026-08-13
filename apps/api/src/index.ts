import "dotenv/config";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ZodTypeProvider } from "@fastify/type-provider-zod";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { redis } from "./lib/redis.js";
import { signAccessToken, signRefreshToken, verifyToken } from "./lib/jwt.js";
import { authPlugin } from "./plugins/auth.js";
import { tenantPlugin } from "./plugins/tenant.js";
import { pool } from "@nexora/database";

// ============================================================
//  Nexora API — Server principal
//  ADR-0009: api_user + RS256 + tenant wrapper + rate limit
// ============================================================

const app = Fastify({
  logger: config.isDev,
}).withTypeProvider<ZodTypeProvider>();

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
await app.register(authPlugin);
await app.register(tenantPlugin);

// --- Healthcheck público ---
app.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
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

    const result = await pool.query(
      "SELECT * FROM find_user_by_email($1)",
      [email],
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

    app.log.info(`Login OK: ${email} (tenant: ${user.tenant_id})`);

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
app.get("/me", { config: { required: true } }, async (request, reply) => {
  if (!request.userId || !request.tenantId) {
    return reply.code(401).send({ error: "No autenticado" });
  }

  const userInfo = await app.withTenant(request, async () => {
    const result = await pool.query(
      "SELECT id, email, name, status FROM users WHERE id = $1",
      [request.userId],
    );
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
app.get("/tenants/me", { config: { required: true } }, async (request, reply) => {
  if (!request.tenantId) {
    return reply.code(401).send({ error: "No autenticado" });
  }

  const tenant = await app.withTenant(request, async () => {
    const result = await pool.query(
      "SELECT id, name, slug, status FROM tenants WHERE id = $1",
      [request.tenantId],
    );
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
app.listen({ port: config.port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Nexora API escuchando en ${address}`);
  app.log.info(`  Rol: api_user (NOBYPASSRLS) | Auth: RS256 | Redis: refresh+ratelimit`);
});
