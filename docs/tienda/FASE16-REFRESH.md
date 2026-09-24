# FASE 1.6 — Refresh token con rotación + renovación silenciosa + logout real · nexora-platform

Fecha: 2026-09-17 · Rama: `arena/01a0afa5-nexora-platform` · Tipo: **seguridad (Nx)**

> **Status**: ✅ implementada. `pnpm --filter @nexora/api run lint`,
> `pnpm --filter @nexora/tienda run typecheck` y `next build` verdes.
> Sin migraciones de base de datos: usa Redis (`refresh:{sub}`, `refresh_prev:{sub}`)
> y los claims RS256 existentes `{ sub, tenantId, type: "access" | "refresh" }`.

---

## 1. Problema que resuelve

La Fase 1.5 dejó el panel protegido, pero la sesión era **solo el access
token** (15 min): vencido el access, el dueño volvía a login. Y el botón de
salir no existía — cerrar la pestaña no cerraba nada. Ahora:

```
Dueño ──login──▶ apps/api POST /login
                 └─▶ body: { accessToken, refreshToken, tenantId }
                     (los consumidores cross-dominio — apps/tienda — NO leen
                      las cookies de la API; cada dominio fija las suyas)

apps/tienda /api/sesion (POST)
  ├─ valida AMBOS tokens con la clave pública RS256
  ├─ nx_session  = accessToken   httpOnly · Secure en prod · SameSite=Lax    · 7 días
  └─ nx_refresh  = refreshToken  httpOnly · Secure en prod · SameSite=Strict · 7 días

/panel/* (middleware Edge)
  ├─ DEMO_MODE ≠ "false"      → pasa directo (preview sin backend)
  ├─ access válido            → pasa
  ├─ access vencido + refresh → renovación silenciosa (abajo)
  └─ cualquier fallo          → /login?next=… borrando ambas cookies

Salir (LogoutButton del header, solo con sesión real)
  └─ DELETE /api/sesion → revoca en la API (espera la respuesta) + borra cookies locales
```

## 2. Rotación en apps/api

### `POST /login`
Ahora devuelve también `refreshToken` en el body (además de fijar las
cookies propias de la API). El refresh se guarda en Redis
`refresh:{sub}` con TTL de 7 días (604800 s).

### `POST /refresh` — rotación estricta
Lee la cookie `refresh_token`, verifica firma y `type: "refresh"`, y compara
contra **dos** claves Redis:

| Clave | Contenido | TTL |
|---|---|---|
| `refresh:{sub}` | el refresh vigente | 604800 s (7 días) |
| `refresh_prev:{sub}` | el presentado en la rotación anterior | 15 s |

Casos:

1. **Presentado == vigente** → rota: firma access nuevo y refresh nuevo
   (`signRefreshToken`), guarda el presentado en `refresh_prev:{sub}` EX 15
   y el nuevo en `refresh:{sub}` EX 604800, setea cookies `access_token` y
   `refresh_token`, devuelve `{ accessToken, refreshToken }`.
2. **Presentado == prev Y hay vigente** → *ventana de gracia* (15 s para
   requests concurrentes): devuelve el vigente **sin rotar de nuevo**.
   CADA uso del prev se loguea:
   `app.log.info({ event_type: "refresh_prev_used", user_id, tenant_id }, "Refresh prev usado")`.
3. **Sin match** (ni vigente ni prev) → `401 "Sesión revocada"`.

Rate limit propio: 20 req/min. Un token robado que llega después de la
rotación no matchea y la sesión queda rechazada (y el uso del prev queda
registrado). El límite lleva `onExceeded` con log estructurado
`{ event_type: "refresh_rate_limited", key }`: el 20/min se dejó fijo a
propósito — si aparecen 429 reales en producción, ese log es el dato con el
que se ajusta el número, no se ajusta a ojo.

### `POST /logout`
`redis.del` de `refresh:{sub}` **y** `refresh_prev:{sub}` + limpieza de
cookies. La revocación es inmediata para todo refresh futuro; el access en
circulación sigue vivo hasta su `exp` (ver decisiones).

## 3. Renovación silenciosa en apps/tienda

### `src/middleware.ts`
1. `DEMO_MODE !== "false"` → `next()` (fix: la doc FASE15 promete panel
   abierto en demo pero el middleware no leía `DEMO_MODE` y la preview
   quedaba trabada en `/login`).
2. Access válido → `next()`.
3. Access inválido + `nx_refresh` → `fetch` server-side
   `POST {NEXT_PUBLIC_API_URL}/refresh` con header
   `cookie: refresh_token=<nx_refresh>` y **timeout de 5 s** vía
   `AbortSignal.timeout(5000)` (Edge + Node ≥ 17.3; si aborta → login; una
   API lenta no frena el render). Si responde OK, el `accessToken` nuevo
   **se revalida con `verificarAccessToken`** y se hace redirect a la MISMA
   URL (pathname + search) seteando `nx_session` (Lax) y `nx_refresh`
   (Strict) nuevas con **todos los atributos explícitos** (`httpOnly`,
   `secure` en prod, `path: "/"`, `maxAge` 7 días y su `sameSite`): sin
   `path: "/"` la cookie quedaría scoped al directorio del request y el
   `DELETE /api/sesion` del logout no recibiría `nx_refresh`, fallando la
   revocación en silencio.
4. Cualquier fallo → redirect `/login?next=…` borrando ambas cookies.

### `src/lib/jwt.ts`
`verificarTokenPlataforma(token)` interno (firma RS256 + claims) y dos
wrappers con la clave pública: `verificarAccessToken` (`type: "access"`) y
`verificarRefreshToken` (`type: "refresh"`). Todo fallo → `null`.

### `src/app/api/sesion/route.ts`
- `POST { accessToken, refreshToken }`: valida ambos con la clave pública y
  fija las dos cookies de arriba (7 días; la vigencia real la manda el `exp`).
- `DELETE`: si hay `nx_refresh`, `POST {NEXT_PUBLIC_API_URL}/logout` con
  forward de `Cookie: refresh_token=…` **esperando la respuesta** (nunca
  falla el logout local — en Vercel un fetch no esperado podría quedar sin
  completar cuando termina la función serverless y la revocación en Redis
  no se haría) y borra ambas cookies. Handlers tipados con `NextRequest`;
  no se exportan constantes (Next solo deja exportar handlers en route files).

### UI
- `login/page.tsx`: el `POST /api/sesion` ahora manda también
  `refreshToken: j.refreshToken`.
- `panel/logout-button.tsx` ("use client"): botón icono `LogOut` →
  `DELETE /api/sesion` → `router.replace("/login")` + `router.refresh()`.
  En `panel/layout.tsx` junto a `ModoSwitcher`, **solo si `!ES_DEMO`**.

### CI
`apps/tienda` suma `"lint": "pnpm run typecheck"` (misma convención que
`apps/api`): el job `lint` del CI (`pnpm -r --if-present run lint`) ahora
tipea también la tienda.

## 4. Pruebas (stack local arriba: Postgres + Redis + apps/api)

1. **Login**: `POST /login` devuelve `{ accessToken, refreshToken, tenantId }`.
2. **Rotación**: `POST /refresh` con la cookie vigente → access + refresh
   nuevos; `refresh_prev:{sub}` en Redis con TTL ~15 s.
3. **Concurrencia**: dos `/refresh` simultáneos con la misma cookie → el
   segundo recibe el vigente sin rotar; aparece el log `refresh_prev_used`.
4. **Reuse**: `/refresh` con el token ya rotado (y fuera de los 15 s) →
   `401 "Sesión revocada"`.
5. **Renovación silenciosa** (`DEMO_MODE=false`): esperar el `exp` del
   access (o usar un JWT vencido) y navegar a `/panel/*` → renueva y entra
   a la misma URL sin pasar por `/login`.
6. **Logout**: botón Salir → cookies borradas en la tienda y
   `refresh:{sub}`/`refresh_prev:{sub}` desaparecen de Redis; el siguiente
   `/refresh` da 401.
7. **Demo**: `DEMO_MODE=true` → `/panel/*` abierto (preview intacta).

## 5. Decisiones y límites conocidos

- **Sesión única por usuario**: `refresh:{sub}` hace que loguearse en un
  segundo dispositivo cierre el primero; el logout es global. Decisión
  explícita del MVP (1 usuario ↔ 1 tenant ↔ 1 comercio).
- **El access sigue válido hasta 15 min post-logout/revocación** (trade-off
  estándar de JWT stateless; revocación inmediata exigiría token opaco o
  consultar Redis por request — no se justifica en el MVP).
- **El refresh token pasa por JavaScript solo en el instante del login**
  (body de `/login` → `fetch` a `/api/sesion`), igual que el access;
  después vive en cookie httpOnly. La rotación + match estricto en Redis
  hacen que un token robado ya rotado sea inútil. El hardening XSS de
  fondo (CSP estricta, security headers) va en Fase 17.
- **NO se agrega claim `jti`**: el match estricto contra el token vigente
  en Redis ya da revocación puntual; `jti` sería el mismo mecanismo con un
  UUID adentro. Si escala el modelo de amenazas, se reevalúa.
- **El refresh lo hace el middleware** (no `setInterval` cliente ni lock
  Redis): la concurrencia real es por pestaña y la absorbe la ventana de
  gracia; un lock exigiría Redis en apps/tienda (rompe la arquitectura);
  los timers cliente no corren en pestañas suspendidas (uso mobile-first).
- **La ventana de gracia también es ventana de robo** (token viejo robado
  dentro de los 15 s obtiene el nuevo): se acepta a cambio de tolerancia a
  concurrencia. La detección hoy es SOLO el log `refresh_prev_used`;
  mientras no exista infra de métricas NO hay detección real — la alerta va
  sí o sí con la observabilidad de Fase 17 (no asumir que está cubierto).
- **SameSite=Strict en `nx_refresh`**: entrar al panel desde un link externo
  con el access vencido pide login en vez de renovar en silencio — y esto
  incluye deep links desde email/WhatsApp al panel, un flujo real
  mobile-first; producto tiene que saber que existe. La renovación
  silenciosa queda intacta en navegación interna.

## 6. Despliegue

- **Vercel (apps/tienda)**: con `DEMO_MODE=true` no hace falta nada (panel
  abierto, como hasta ahora). Con sesión real: `JWT_PUBLIC_KEY` y
  `NEXT_PUBLIC_API_URL` ya documentados en FASE15.
- **apps/api**: sin configuración nueva — usa el Redis existente.

---

## 7. Actualización 2026-09-24 — U2 (roles) + fixes de seguridad

> Sección de actualización: lo que sigue SUSTITUYE los comportamientos que
> contradiga de las secciones 1–6 (la historia se conserva tal cual).
> Validado con E2E completo (stack arriba: Postgres embebido con migraciones
> 0000→0014 vía `node migrate.mjs`, Redis, API como `api_user`, tienda
> `DEMO_MODE=false`) — matriz de aceptación 32/32.

### 7.1 Rotación ATÓMICA en un solo `EVAL` (cierra la carrera de Fase 1.6)

El flujo viejo (GET → comparar → SET) tenía una carrera: dos `/refresh`
simultáneos con la misma cookie rotaban **las dos veces** y una de las
respuestas dejaba un refresh que ya no matcheaba en Redis (los dos clientes
se bloqueaban al intentar renovar de nuevo). Ahora toda la decisión corre en
un script Lua atómico (Redis ejecuta `EVAL` single-threaded; no hay punto de
intercalación entre leer y escribir):

```lua
if redis.call('GET', KEYS[1]) == ARGV[1] then      -- presentado == vigente
  redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])   -- previo ← presentado
  redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[4])   -- vigente ← nuevo
  return ARGV[3]                                       -- "yo roté"
end
local cur = redis.call('GET', KEYS[1])
if cur and redis.call('GET', KEYS[2]) == ARGV[1] then return cur end  -- concurrente: el vigente
return nil                                                    -- revocado / reuso
```

- **Ventana de gracia 15 s → 60 s** (`refresh_prev:{sub}` EX 60): la
  concurrencia real (varias pestañas/devices renovando a la vez) ya no
  bloquea al perdedor, que recibe el vigente en vez de un token muerto.
- **La API firma el refresh nuevo ANTES del `EVAL`**: si fallara la firma,
  nada se toca en Redis. El resultado del script decide: `ARGV[3]` = rotó
  (setea cookies con su propio refresh) · otro valor = le toca el vigente
  (no rota de nuevo; se loguea `refresh_prev_used`) · `nil` = 401.

### 7.2 Detección: lo que la ventana SÍ y NO permite

- **Reuso del token viejo DENTRO de los 60 s es indistinguible de un request
  legítimo concurrente** (el atacante y la víctima mandan exactamente el
  mismo token). La respuesta es el vigente (el atacante NO obtiene un token
  nuevo ni corta la sesión de la víctima) y queda registrado en el log
  `refresh_prev_used`. **Hoy la detección es solo ese log** — sin infra de
  métricas no hay alerta (se repite la advertencia de la sección 5).
- **Reuso FUERA de los 60 s → 401** y la sesión queda muerta: el prev
  expiró, el vigente no matchea → el script devuelve `nil`.
- **Logout/suspensión → 401 inmediato**: `DEL` de ambas claves.

### 7.3 El estado y el rol salen de la BASE, no del payload (migraciones 0013/0014)

Antes de rotar, `/refresh` consulta `SELECT * FROM get_user_auth_state($1)`
(función `SECURITY DEFINER` nueva, patrón 0006/0007/0010: `STABLE`,
`search_path` fijo, `REVOKE EXECUTE FROM PUBLIC`, `GRANT EXECUTE TO
api_user`):

| Estado en DB | Resultado |
|---|---|
| usuario borrado (sin fila) | `401` + `DEL` de ambas claves (revoca) |
| `status ≠ 'active'` (suspendido/inactivo) | `401` + `DEL` de ambas claves |
| `role_name` actual | el access y el refresh **nuevos** se firman con ese rol |

Consecuencias verificadas en E2E: un **downgrade de rol en la base rige en el
próximo refresh** (sin esperar 7 días al exp del refresh viejo), y un usuario
suspendido **no renueva** (el access en circulación sigue vivo hasta su `exp`
de 15 min, trade-off conocido de la sección 5). `find_user_by_email` (0013)
se redimensionó en el mismo patrón: ahora también devuelve `role_name`
(`NULL` = usuario anterior a 0013 → compat dueño, ver 7.5).

### 7.4 El refresh token SÍ lleva `jti` (decisión de la sección 5, reevaluada)

La sección 5 decía "NO se agrega claim `jti`… si escala el modelo de
amenazas, se reevalúa". El E2E de esta actualización encontró el caso: con
RS256 determinístico e `iat` en segundos, **dos refresh firmados en el mismo
segundo son byte-iguales** — la rotación los hace indistinguibles (el
"vigente nuevo" es el mismo string que el viejo, y el reuso "fuera de
ventana" sigue matcheando contra `refresh:{sub}`). `signRefreshToken` ahora
setea `jti: crypto.randomUUID()`: cada rotación produce un token único, la
comparación en Redis vuelve a ser una comparación de identidad y la matriz
de reuso se vuelve determinista. El acceso no se toca (no hay rotación de
access; `jti` no le sirve).

### 7.5 Compatibilidad y permisos (U2)

- **Tokens sin claim `role` = dueño** (`esDueno()` en `apps/tienda/src/lib/sesion.ts`):
  los tokens emitidos antes de 0013 (7 días de vigencia) siguen siendo de
  dueño; no hay lockout del fundador.
- **5 permisos de panel**: `pedidos`, `catalogo`, `clientes`, `caja:read`,
  `config:manage`. El trigger `trg_tenant_new_tienda_roles` (0014,
  `AFTER INSERT ON tenants`, `SECURITY DEFINER`) crea los roles **Dueño**
  (5 permisos) y **Empleado** (3: sin `caja:read` ni `config:manage`) en cada
  tenant nuevo; idempotente (re-ejecutado en E2E sin duplicados).
- **El panel filtra por rol**: la nav oculta `caja`/`config` a empleados
  (`requiereDueno`) y las páginas `caja`/`config` redirigen a `/panel/pedidos`
  si `!esDueno`; `GET /api/reporte` devuelve `403` sin permiso de dueño.
  La URL directa no es una vía de acceso (el guard está en la página, no en
  el menú).
- **`guardarConfigAction`** (server action) repite el check en el servidor:
  `!esDueno` → `{ ok:false, error:"Sin permisos" }` (el menú oculto no era
  una barrera por sí solo).

### 7.6 BFF de login + checks de sesión (fixes 5 y 6)

- **`POST /api/login` en apps/tienda (BFF)**: el navegador manda SOLO
  `{ email, password }`; el JWT se obtiene en el servidor
  (Node → `apps/api /login`, timeout 10 s) y las cookies `nx_session` /
  `nx_refresh` se fijan ahí mismo. **El refresh token nunca toca
  JavaScript** (el flujo viejo `login → body → /api/sesion` quedaba como
  compat). Mapa de errores: API 401 → "Credenciales inválidas" (401),
  403 → "Usuario inactivo" (403), otro/timeout → "Error del servidor" (502).
- **Fix #5 — `POST /api/sesion` (compat, holder de tokens crudos)**: antes
  de fijar cookies exige que access y refresh pertenezcan al **mismo
  `userId` y `tenantId`** (ambos revalidados con la clave pública). Impide
  armar una sesión híbrida con un refresh robado de otra cuenta.
- **Fix 6a — `DELETE /api/sesion` (logout)**: la revocación remota ya no
  tapa fallas: si `apps/api /logout` no responde bien, las cookies locales
  se borran igual y la respuesta lleva `warning: "revocation_failed"` (log
  `console.warn` en el servidor). El cliente nunca se queda en un estado
  "salí pero mi refresh sigue vivo sin saberlo".
- **Fix #1 — `DEMO_MODE` fail-closed**: demo solo con `"true"` **explícito**
  (`DEMO_MODE === "true"` en middleware, data y sesión). Variable ausente,
  vacía o con typo → exige sesión. El despliegue público de Vercel setea
  `DEMO_MODE=true` a propósito y sigue funcionando (verificado en E2E:
  `/panel/*` 200 sin login); local sin la variable → `/panel` redirige a
  `/login` (verificado en E2E). `apps/tienda/.env.example` documenta ambos
  modos y se agregó `next.config.mjs` con CSP + headers de seguridad
  (fix #4 del parche).

### 7.7 Validación E2E (2026-09-24) — 32/32

Stack: Postgres 18 embebido (migraciones 0000→0014 con `node migrate.mjs`;
DDL de las tablas de tienda generado con `drizzle-kit generate` hacia un
directorio scratch — no entran al journal), Redis (en el sandbox, un stub
RESP con el `EVAL` portado de forma atómica; ver límite abajo), `apps/api`
conectado como **`api_user`** (rol runtime) y `apps/tienda` con
`DEMO_MODE=false` contra la DB real.

| Caso | Resultado |
|---|---|
| Login con contraseña mala → 401 "Credenciales inválidas" | ✅ |
| Dueño → `/panel/pedidos`, `/panel/caja`, `/panel/config`, `/api/reporte` (CSV + BOM) → 200 | ✅ |
| Empleado → `caja`/`config` 307 a `/panel/pedidos`; `/api/reporte` 403; `pedidos` 200 | ✅ |
| DOS `/refresh` simultáneos con el mismo token → ambos 200 con el MISMO refresh vigente | ✅ |
| Reuso del original dentro de la ventana de 60 s → 200 con el vigente (log `refresh_prev_used`) | ✅ |
| Reuso del original fuera de la ventana → 401 | ✅ |
| Downgrade Dueño→Empleado en DB → refresh → el access nuevo trae `role=Empleado`; caja 307; reporte 403; restaurado → vuelve a 200 | ✅ |
| Usuario suspendido en DB → refresh 401 + claves borradas de Redis + segundo intento 401 | ✅ |
| Token sin claim `role` → tratado como dueño (caja/reporte 200) | ✅ |
| `POST /api/sesion` con access de A + refresh de B → 401; par correcto → 200 | ✅ |
| `DEMO_MODE` ausente → `/panel` 307 a `/login`; `DEMO_MODE=true` → panel abierto (compat Vercel) | ✅ |

Verificado además en la base: `api_user` **sin** grants directos sobre
`roles`/`permissions`/`roles_to_permissions` (solo `EXECUTE` sobre las
funciones angostas); rol sin permisos no puede ejecutar
`get_user_auth_state` (42501); re-ejecución bruta de 0013/0014 idempotente
(sin roles duplicados); el trigger 0014 crea Dueño/Empleado al insertar el
tenant seed.

**Límite del E2E en el sandbox**: no hay binario de Redis real alcanzable
ni `apt`, así que el `EVAL` de rotación corrió sobre un servidor RESP mínimo
que **porta el script línea a línea y lo ejecuta atómicamente** (sin
intercalación, igual que el `EVAL` single-threaded de Redis). Lo que valida
esa validación es la integración de la API (keys/ARGV correctos, los tres
resultados del script, cookies, 401s) y la matriz completa; la atomicidad
del Lua sobre Redis real descansa en la ejecución single-threaded de `EVAL`
(documentada por Redis). Postgres fue real (embebido, 18.4).

### 7.8 Despliegue (cambios sobre la sección 6)

- **Migraciones nuevas**: `0013_tienda_roles.sql` y `0014_user_auth_state.sql`
  entran al journal (drizzle). En el banco existente: correr
  `node migrate.mjs` desde `packages/database` (nunca `drizzle-kit migrate`).
  Ambas son idempotentes; 0014 deja el trigger `trg_tenant_new_tienda_roles`
  activo para tenants futuros (los existentes pueden re-ejecutar el bloque de
  `provision_tienda_roles()` de la migración para backllear sus roles).
- **`apps/api`**: sin configuración nueva. **`apps/tienda`**: igual que la
  sección 6, más `DEMO_MODE` documentado en `.env.example` (demo = `"true"`
  explícito; producción = variable ausente).
