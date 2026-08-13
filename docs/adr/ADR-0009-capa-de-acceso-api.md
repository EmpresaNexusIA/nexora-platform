# ADR-0009: Capa de Acceso de la API — Rol Runtime, Tenant Wrapper y Auth

**Estado:** SELLADA ✅ (aprobada por el fundador el 13/8/2026)
**Fecha:** 13 de agosto de 2026
**Contexto:** Fase B — B1 (API real). Primera superficie HTTP pública de Nexora.

---

## Contexto

La Fase A cerró con `api_user` (NOBYPASSRLS) certificado como rol runtime vía la
prueba Multi-Tenancy E2E (16/16 PASS). Sin embargo, el desarrollo siguió usando
`nexora_admin` (que bypasea RLS por ser dueño de las tablas) para todo lo que no
era la prueba.

La API que construye la Fase B es, literalmente, la primera pieza real de "la
capa de acceso" que el ADR-0008 menciona como condición para dejar de usar
`nexora_admin`. Si el `DATABASE_URL` de `apps/api` apunta a `nexora_admin`
"porque es más fácil arrancar así", se repite exactamente el agujero que la
revisión del ADR-0008 ya señaló — con la diferencia de que ahora hay una API
HTTP real exponiéndolo al mundo, no solo un desarrollador local.

Al mismo tiempo, `packages/database/src/tenant-db.ts` ya tiene la pieza de oro:
`withTenantDatabase()` que hace `BEGIN` + `SET app.current_tenant_id` + `COMMIT`/
`ROLLBACK`. Pero esa pieza solo sirve si la API la usa estructuralmente en cada
request, no como una opción que el desarrollador puede olvidar.

## Decisión

### 1. Conexión a datos: `api_user` desde el día 1

`apps/api` se conecta a PostgreSQL como `api_user` (NOBYPASSRLS, LOGIN). Nunca
`nexora_admin`. Nunca `postgres`.

- `nexora_admin` queda reservado para migraciones y mantenimiento.
- `api_user` es el único rol que la API usa en runtime.
- El `DATABASE_URL` de la API en `.env` apunta a `api_user`, no a `nexora_admin`.

Esto convierte el ADR-0008 de aspiracional en real: la "capa de acceso" que
menciona existe a partir de esta decisión.

### 2. Tenant wrapper estructural (no opcional)

Un plugin de Fastify envuelve cada handler autenticado en
`withTenantDatabase()` con el `tenantId` extraído del JWT.

El diseño hace **estructuralmente imposible** que una ruta consulte la base sin
pasar por el wrapper:

- El plugin de auth verifica el JWT, extrae `tenantId` y `userId`, y los
  inyecta en `request.tenantId` / `request.userId`.
- Un plugin de tenant envuelve el handler: si la ruta declaró auth, el handler
  recibe `request.db` ya envuelto en `withTenantDatabase(tenantId, ...)`.
- Una ruta que **no** declaró auth **no tiene** `request.db` disponible.
- Si el handler referencia `request.db` sin declarar auth, TypeScript no
  compila — el error se detecta en build, no en producción.

Esto hace que el RLS del ADR-0003 sirva de algo en la práctica, no solo en el
papel: cada query que sale de la API pasa por `SET app.current_tenant_id` antes
de tocar la base.

### 3. JWT asimétrico (RS256)

Firma con clave privada RS256. Verificación con clave pública.

- La clave privada vive **solo** donde se emiten tokens (la API, en el endpoint
  de login/refresh).
- Cualquier otro servicio que necesite verificar tokens (orchestrator, futuro
  admin) usa la clave pública — nunca puede firmar tokens falsos aunque se
  comprometa.
- Descartado HS256: repite el patrón del secreto simétrico filtrado que ya los
  mordió (ADD-12, el JWT de Supabase).

### 4. Access token corto (15 min) + refresh en Redis

- **Access token:** stateless, firmado con RS256, TTL 15 min. Verificable con
  la clave pública sin tocar Redis ni la base.
- **Refresh token:** stored en Redis con TTL largo (7 días). Permite
  revocación inmediata (cerrar sesión de verdad, no "esperar a que expire").
  La clave en Redis incluye el `userId` para invalidar todas las sesiones de
  un usuario de una sola vez si hace falta.

Redis ya está construido y ocioso (digest-pinneado, auth probado con NOAUTH).
Esta es su primera carga de trabajo real.

### 5. Rate limiting en `/login` con store en Redis

`@fastify/rate-limit` con store en Redis.

`/login` es el primer endpoint público expuesto a fuerza bruta. Hasta ahora
todo lo público era un bot de Telegram con whitelist por `chat_id`; esto es
distinto: cualquiera en internet le puede pegar al `/login`.

Límite inicial: 10 intentos por IP cada 60 segundos. Ajustable.

### 6. Cookies: `httpOnly` + `Secure` + `SameSite=Lax`

- `httpOnly`: el JavaScript del panel no puede leer el token.
- `Secure`: el navegador solo lo manda por HTTPS.
- `SameSite=Lax` (no Strict): el panel y la API vivirán en subdominios distintos
  (`panel.nexora.localhost` / `api.nexora.localhost` en dev;
  `panel.nexora.com` / `api.nexora.com` en prod). Lax permite que la cookie se
  envíe al navegar al sitio, sin abrirla a CSRF de otros orígenes.

En desarrollo local (`localhost`), `Secure` se omite porque no hay HTTPS real
(mkcert emite certs de CA local, pero la cookie `Secure` sobre `localhost` es
manejable si el entorno lo soporta; si no, se usa `httpOnly` + `SameSite=Lax`
sin `Secure` en dev, y `Secure` se activa en prod).

### 7. Panel: el panel del fundador (no el del cliente)

El panel de B5 es el panel del fundador — el primer usuario real dentro de
Nexora gestionando su tenant. No es el panel que va a ver un cliente externo
todavía.

El panel que ve un cliente externo es parte de SP6 con el mismo nivel de
aislamiento que las webs de clientes (red propia, dominio propio, sin
`nexora_net`). Pero se construye con esa separación en mente desde el inicio.

## Stack técnico

| Pieza | Decisión |
|-------|----------|
| API | Fastify + `@fastify/type-provider-zod` |
| Validación | Zod (vía type-provider) |
| Base de datos | Drizzle (ya existe) |
| Conexión DB | `api_user` (NOBYPASSRLS) |
| Tenant wrapper | Plugin de Fastify + `withTenantDatabase()` |
| Auth | JWT RS256 (access 15min + refresh en Redis) |
| Rate limiting | `@fastify/rate-limit` con store Redis |
| Cookies | `httpOnly` + `Secure` (prod) + `SameSite=Lax` |
| Panel | React + Vite |

## Descartado

- **HS256:** repite el patrón del secreto simétrico filtrado (ADD-12).
- **JWT puramente stateless sin revocación:** no sirve para "banear a un usuario
  ya" — el access token de 15 min expira solo, pero el refresh se revoca al
  instante.
- **`nexora_admin` "por ahora":** ya se dijo eso mismo del dev local y sigue sin
  resolverse. La API es el momento exacto en que se resuelve.
- **Auth sin wrapper estructural:** si el wrapper es opcional, algún día se
  olvida y una ruta consulta la base sin `SET app.current_tenant_id` — RLS no
  filtra nada porque el contexto está vacío. El wrapper obligatorio lo hace
  imposible.

## Revisita

- Cuando SP6 (roles reales) llegue, "quién puede emitir tokens para quién" se
  vuelve más fino que "login = tenant + user". El modelo de refresh en Redis
  ya soporta invalidar sesiones por usuario; el modelo de roles amplía qué
  acciones puede hacer cada token, no cómo se emite.
- Si el panel del fundador migra a ser panel de cliente (SP6), se formaliza el
  aislamiento en una ADR equivalente a la de webs de clientes.

## Consecuencias

1. La API necesita la clave privada RS256 en su `.env` (gitignored, bóveda).
2. La API necesita la URL de Redis en su `.env`.
3. `api_user` necesita password en la base (ya la tiene del ADR-0008).
4. El primer endpoint (`/login`) es también el primero con rate limiting.
5. TypeScript se vuelve la primera línea de defensa: si una ruta no declara
   auth, no tiene `request.db`, y no compila si lo referencia.

---

*ADR-0009 SELLADA — 13/8/2026. Aprobada por el fundador antes de arrancar B1.*
*Stack: Fastify + api_user + RS256 + refresh tokens en Redis.*
