import "dotenv/config";
import crypto from "node:crypto";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { redis } from "./lib/redis.js";
import { signAccessToken, signRefreshToken, verifyToken, type NexoraJWTPayload } from "./lib/jwt.js";
import { checkReadiness } from "./lib/readiness.js";
import { consumeActivationToken } from "./lib/activation-token.js";
import { authPlugin } from "./plugins/auth.js";
import { tenantPlugin } from "./plugins/tenant.js";
import { leadsPlugin } from "./plugins/leads.js";
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

// --- Documentación OpenAPI ---
await app.register(swagger, {
  openapi: {
    info: {
      title: "Nexora Platform API",
      description: "API pública y administrativa de Nexora Platform",
      version: "1.0.0",
    },
    servers: [
      {
        url: config.isDev ? "http://localhost:3000" : `https://api.${config.cookie.domain}`,
      },
    ],
    tags: [
      { name: "Health", description: "Healthchecks y readiness" },
      { name: "Auth", description: "Autenticación y sesiones" },
      { name: "Onboarding", description: "Aprovisionamiento y activación de tenants" },
      { name: "User", description: "Perfil y datos del usuario autenticado" },
      { name: "Tenant", description: "Gestión del tenant" },
    ],
  },
});

await app.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "list",
    deepLinking: true,
  },
});

// --- Plugins de dominio ---
// Se aplican sobre la instancia raíz para que hooks y decoradores
// alcancen obligatoriamente a todas las rutas declaradas debajo.
await authPlugin(app);
await tenantPlugin(app);
await leadsPlugin(app);

// Tags el tag CRM al OpenAPI (opcional pero prolijo)

// Delay anti-timing para prevenir timing attacks en rutas sensibles
const antiTimingDelay = () => new Promise((resolve) => setTimeout(resolve, 200));

// --- Compatibilidad: /health conserva la respuesta historica ---
app.get(
  "/health",
  {
    schema: {
      tags: ["Health"],
      summary: "Healthcheck básico",
    },
    config: { rateLimit: false },
  },
  async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  },
);

// --- Liveness: Fastify esta ejecutando el event loop ---
app.get(
  "/health/live",
  {
    schema: {
      tags: ["Health"],
      summary: "Liveness probe",
    },
    config: { rateLimit: false },
  },
  async () => {
    return { status: "alive", timestamp: new Date().toISOString() };
  },
);

// --- Readiness: la API puede trabajar con sus dependencias criticas ---
app.get(
  "/health/ready",
  {
    schema: {
      tags: ["Health"],
      summary: "Readiness probe",
    },
    config: { rateLimit: false },
  },
  async (_request, reply) => {
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
  },
);

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
      tags: ["Auth"],
      summary: "Iniciar sesión",
      description: "Autentica un usuario activo. El email se normaliza a minúsculas automáticamente.",
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
      role_name: string | null; // 0013: Dueño | Empleado | NULL
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

    // El rol sale de la base (find_user_by_email 0013): NULL → undefined
    // (compat con usuarios/tenants previos a 0013 → trato de dueño).
    const role = user.role_name || undefined;
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(user.user_id, user.tenant_id, role),
      signRefreshToken(user.user_id, user.tenant_id, role),
    ]);

    const refreshKey = refreshKeys(user.user_id).vigente;
    await redis.set(refreshKey, refreshToken, "EX", REFRESH_TTL_S);

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

    // refreshToken también por body: los consumidores cross-dominio
    // (apps/tienda) no leen las cookies de la API — cada dominio materializa
    // su propia cookie host-only (ver apps/tienda /api/sesion).
    return { accessToken, refreshToken, tenantId: user.tenant_id };
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
      tags: ["Onboarding"],
      summary: "Activar cuenta de tenant",
      description:
        "Consume un token de activación de un solo uso para activar un tenant, " +
        "establecer la contraseña del usuario fundador y migrar los estados de " +
        "cliente CRM, tenant y usuario a activos. El token se invalida permanentemente " +
        "al consumirse. Rate limit: 3 intentos/15min por IP, 1 intento/5min por token.",
      body: onboardingActivateSchema,
      response: {
        200: z.object({
          ok: z.literal(true),
          message: z.string(),
        }),
        400: z.object({
          error: z.string().describe("Mensaje uniforme para cualquier fallo de token o precondición"),
        }),
      },
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
    return { ok: true as const, message: "Cuenta activada exitosamente" };
  },
);

// ============================================================
//  POST /refresh — Renovar tokens (ROTACIÓN ATÓMICA de refresh token)
// ============================================================

const REFRESH_PREV_TTL_S = 60; // ventana de gracia para requests concurrentes
const REFRESH_TTL_S = 7 * 24 * 60 * 60;

/** Único lugar que construye las claves de refresh. Layout actual:
 *  refresh:{sub} / refresh_prev:{sub}; el layout a futuro
 *  refresh:{sub}:{sessionId} (sesión por dispositivo) se cambia SOLO acá. */
function refreshKeys(sub: string) {
  return { vigente: `refresh:${sub}`, prev: `refresh_prev:${sub}` };
}

// Rotación atómica (Lua): cierra la carrera GET/comparar/SET de Fase 1.6
// (dos /refresh simultáneos con la misma cookie rotaban ambas veces y una de
// las respuestas dejaba un refresh que ya no matcheaba en Redis).
// Devuelve: ARGV[3] si rotó · el vigente si el presentado era el prev y un
// request concurrente ya rotó (ventana de 60 s) · nil si revocado o reuso
// fuera de la ventana.
const LUA_ROTAR_REFRESH = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])
  redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[4])
  return ARGV[3]
end
local cur = redis.call('GET', KEYS[1])
if cur and redis.call('GET', KEYS[2]) == ARGV[1] then return cur end
return nil
`;

app.post(
  "/refresh",
  {
    schema: {
      tags: ["Auth"],
      summary: "Renovar access token (rotación atómica de refresh token)",
      description:
        "Renueva el access token usando la cookie refresh_token con ROTACIÓN ATÓMICA " +
        "(script Lua: un solo request gana la rotación; los concurrentes reciben el " +
        "refresh vigente dentro de la ventana de gracia de 60 s). Antes de rotar se " +
        "consulta get_user_auth_state en PostgreSQL: usuario inexistente/inactivo/" +
        "suspendido → 401 y revocación de la sesión; el rol y el estado salen de la " +
        "base (no del payload) para que un downgrade/revocación rija en el próximo " +
        "refresh. Un token que no coincide ni con el vigente ni con el previo " +
        "devuelve 401 (sesión revocada).",
    },
    // 20/min fijo a propósito: si aparecen 429 reales en producción, el log
    // refresh_rate_limited es el dato con el que se ajusta el número — no se
    // ajusta a ojo.
    config: {
      rateLimit: {
        max: 20,
        timeWindow: "1 minute",
        onExceeded: (_req, key) =>
          app.log.warn(
            { event_type: "refresh_rate_limited", key },
            "Rate limit excedido en /refresh",
          ),
      },
    },
  },
  async (request, reply) => {
    const presentado = request.cookies?.refresh_token;
    if (!presentado) {
      return reply.code(401).send({ error: "No hay refresh token" });
    }

    let payload: NexoraJWTPayload;
    try {
      payload = await verifyToken(presentado);
    } catch {
      return reply.code(401).send({ error: "Refresh token inválido" });
    }
    if (payload.type !== "refresh") {
      return reply.code(401).send({ error: "Token inválido" });
    }

    const { vigente: claveVigente, prev: clavePrev } = refreshKeys(payload.sub);

    // El estado y el rol salen de la base, NUNCA del payload (que vivía 7 días
    // congelado): un downgrade de rol rige en el próximo refresh y un usuario
    // suspendido/inactivo no renueva.
    const estado = await pool.query(
      "SELECT * FROM get_user_auth_state($1)",
      [payload.sub],
    );
    const fila = estado.rows[0] as
      | { user_status: string; role_name: string | null }
      | undefined;
    if (!fila || fila.user_status !== "active") {
      // Sin fila (usuario borrado) o inactivo/suspendido → revocar la sesión.
      await Promise.all([redis.del(claveVigente), redis.del(clavePrev)]);
      return reply.code(401).send({ error: "Sesión revocada" });
    }
    const rol = fila.role_name || undefined; // NULL → compat dueño

    // Rotación atómica: firma el refresh nuevo ANTES del Lua (si falla la
    // firma, nada se toca) y deja a Redis decidir quién rotó.
    const nuevoRefresh = await signRefreshToken(payload.sub, payload.tenantId!, rol);
    const resultado = (await redis.eval(
      LUA_ROTAR_REFRESH,
      2,
      claveVigente,
      clavePrev,
      presentado,
      REFRESH_PREV_TTL_S,
      nuevoRefresh,
      REFRESH_TTL_S,
    )) as string | null;

    // nil → revocado, o reuso de un token ya rotado FUERA de la ventana de 60 s.
    if (resultado === null) {
      return reply.code(401).send({ error: "Sesión revocada" });
    }

    const cookieOpts = {
      httpOnly: true,
      secure: config.cookie.secure,
      path: "/",
      domain: config.cookie.domain,
    } as const;

    const accessToken = await signAccessToken(payload.sub, payload.tenantId!, rol);
    reply.setCookie("access_token", accessToken, { ...cookieOpts, sameSite: "lax" });
    reply.setCookie("refresh_token", resultado, { ...cookieOpts, sameSite: "lax" });

    if (resultado !== nuevoRefresh) {
      // El presentado era el prev: un request concurrente ya rotó. Devolvemos
      // el vigente SIN rotar de nuevo (ventana de gracia de 60 s).
      // Detección: SOLO este log — dentro de la ventana el uso de un token
      // viejo robado es indistinguible de un request legítimo concurrente
      // (ver docs/tienda/FASE16-REFRESH.md, sección 5).
      app.log.info(
        { event_type: "refresh_prev_used", user_id: payload.sub, tenant_id: payload.tenantId },
        "Refresh prev usado",
      );
    }

    return { accessToken, refreshToken: resultado };
  },
);

// ============================================================
//  POST /logout — Revocar refresh token
// ============================================================
app.post(
  "/logout",
  {
    schema: {
      tags: ["Auth"],
      summary: "Cerrar sesión",
      description:
        "Revoca la sesión en Redis (borra refresh:{sub} y refresh_prev:{sub}) y elimina " +
        "las cookies HTTP de autenticación.",
    },
  },
  async (request, reply) => {
    const refreshToken = request.cookies?.refresh_token;
    if (refreshToken) {
      try {
        const payload = await verifyToken(refreshToken);
        const { vigente, prev } = refreshKeys(payload.sub);
        await Promise.all([redis.del(vigente), redis.del(prev)]);
      } catch {
        // Token inválido — igual limpiamos cookies
      }
    }

    reply.clearCookie("access_token", { path: "/" });
    reply.clearCookie("refresh_token", { path: "/" });
    return { ok: true };
  },
);

// ============================================================
//  GET /me — Ruta protegida (demuestra el wrapper de tenant)
// ============================================================
app.get(
  "/me",
  {
    schema: {
      tags: ["User"],
      summary: "Perfil del usuario autenticado",
      description: "Retorna los datos del usuario autenticado bajo el contexto de su tenant.",
    },
    config: { required: true, withTenant: true },
  },
  async (request, reply) => {
    if (!request.userId || !request.tenantId) {
      return reply.code(401).send({ error: "No autenticado" });
    }

    const userInfo = await app.withTenant(request, async (db) => {
      const result = await db.execute(sql`
        SELECT u.id, u.email, u.name, u.status, r.name AS role
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id AND r.deleted_at IS NULL
        WHERE u.id = ${request.userId}
      `);
      return result.rows[0];
    });

    if (!userInfo) {
      return reply.code(404).send({ error: "Usuario no encontrado" });
    }

    return userInfo;
  },
);

// ============================================================
//  GET /tenants/me — Datos del tenant del usuario
// ============================================================
app.get(
  "/tenants/me",
  {
    schema: {
      tags: ["Tenant"],
      summary: "Datos del tenant actual",
      description: "Retorna la información del tenant al cual pertenece el usuario autenticado.",
    },
    config: { required: true, withTenant: true },
  },
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
  },
);

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
  app.log.info(`  Documentación OpenAPI en ${address}/docs`);
});
