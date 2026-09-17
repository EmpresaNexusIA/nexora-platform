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
  └─ DELETE /api/sesion → revoca en la API (fire-and-forget) + borra cookies locales
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
registrado).

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
   `cookie: refresh_token=<nx_refresh>` y **timeout de 5 s** (si aborta →
   login; una API lenta no frena el render). Si responde OK, el
   `accessToken` nuevo **se revalida con `verificarAccessToken`** y se hace
   redirect a la MISMA URL (pathname + search) seteando `nx_session` (Lax)
   y `nx_refresh` (Strict) nuevas.
4. Cualquier fallo → redirect `/login?next=…` borrando ambas cookies.

### `src/lib/jwt.ts`
`verificarTokenPlataforma(token)` interno (firma RS256 + claims) y dos
wrappers con la clave pública: `verificarAccessToken` (`type: "access"`) y
`verificarRefreshToken` (`type: "refresh"`). Todo fallo → `null`.

### `src/app/api/sesion/route.ts`
- `POST { accessToken, refreshToken }`: valida ambos con la clave pública y
  fija las dos cookies de arriba (7 días; la vigencia real la manda el `exp`).
- `DELETE`: si hay `nx_refresh`, `POST {NEXT_PUBLIC_API_URL}/logout` con
  forward de `Cookie: refresh_token=…` **fire-and-forget** (nunca falla el
  logout local) y borra ambas cookies. Handlers tipados con `NextRequest`;
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
