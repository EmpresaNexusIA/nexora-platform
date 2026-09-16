# FASE 1.5 — Auth real del panel (`/panel/*`) · nexora-platform

Fecha: 2026-09-16 · Rama: `feat/fase15-auth-panel` · Tipo: **seguridad (Nx)**

> **Status**: ✅ implementada, `tsc --noEmit` limpio y `next build` verde (12 rutas + middleware edge).
> Sin migraciones de base de datos: usa `users`/`tenants` existentes + JWT RS256 de apps/api.

---

## 1. Problema que resuelve

Con la Fase 1 cualquier persona con la URL entraba al panel del comercio
(hardcodeado a la demo). Regla de producto pisada: *"cada comercio ve solo
lo suyo"*. Ahora:

```
Dueño ──login──▶ apps/api (POST /login) ──▶ JWT RS256 firmado
Panel (apps/tienda) lo verifica con la clave PÚBLICA (nunca la privada)
→ cookie httpOnly propia → /panel/* protegido en Edge
→ comercio derivado del tenantId del JWT, no de un slug en el código
```

## 2. Piezas entregadas (apps/tienda)

### `src/lib/jwt.ts` — verificación (Edge-compatible)
`verificarAccessToken(token)` con **jose + RS256** usando `JWT_PUBLIC_KEY` (PEM,
acepta formato de una línea con `\n`). Valida `alg`, `exp` y claims
`{ sub, tenantId, type: "access" }` conforme a `apps/api/src/lib/jwt.ts`.
Todo fallo → `null` (nunca lanza).

### `src/middleware.ts` — guard en Edge
Matcher `/panel/:path*`. Sin cookie `nx_session` válida → redirect
`/login?next=<ruta>` y limpia la cookie vencida. **La tienda pública
(`/t/[slug]`, checkout, `/pedido/[token]`) queda abierta** (el cliente final
compra sin login).

### `src/lib/sesion.ts` — sesión y “tienda actual” (server-only)
- `getSesion()` → `{ userId, tenantId } | null` desde la cookie.
- `getTiendaActual()`: `DEMO_MODE=true` → `panaderia-maria` (preview sigue
  funcionando sin login); si no → sesión → `getTiendaPorTenantId(tenantId)`.
- `requireTiendaActual()` → guard para páginas (redirect a `/login`).

Las 7 páginas/layout del panel dejan de hardcodear `"panaderia-maria"` y
usan `requireTiendaActual()`; `api/reporte` responde 401 sin sesión.

### `src/app/login/page.tsx` — UI (voseo es-AR)
Email + contraseña → `POST {NEXT_PUBLIC_API_URL}/login` → recibe
`accessToken` por **body** → lo materializa como cookie de **este dominio**
vía `/api/sesion` → entra al panel. Mensajes de error amigables (401,
cuenta inactiva, sin conexión).

### `src/app/api/sesion/route.ts` — cookie host-only
- `POST { accessToken }`: verifica el JWT y setea `nx_session`
  (`httpOnly, Secure en prod, SameSite=Lax, path=/, 7 días` — la vigencia
  real la marca el `exp` del JWT).
- `DELETE`: logout (borra la cookie).

### DataAdapter
`getTiendaPorTenantId?(tenantId)` (opcional en el contrato) +
implementación en `platform.ts`:
`select c.*, t.slug from comercios c join tenants t … where c.tenant_id = $1`.
`actions.ts#getTiendaActual` delega en `lib/sesion.ts`.

### Fix colateral (typecheck/build)
El PR #1 compiliaba por Vercel off — `platform.ts` tenía 6 errores TS
latentes (`portadaUrl`, categorías sin `comercioId/eliminado`, pedidos sin
`clienteId/eliminado`, clientes sin `comercioId/perfil_id`). **Corregidos**:
`types.ts` suma `portadaUrl?: string` y todos los mapeos snake→camel
quedan completos. Además `package.json` suma `jose@^6.0.12` y
`server-only@^0.0.1` (lockfile regenerado).

## 3. Configuración necesaria (NADA huérfano)

| Variable (apps/tienda) | Valor |
|---|---|
| `JWT_PUBLIC_KEY` | Contenido de `apps/api/keys/public.pem` (o el env que use apps/api), **una línea con `\n`, entre comillas dobles** |
| `NEXT_PUBLIC_API_URL` | URL pública de la API (`http://127.0.0.1:3001` local; en prod `https://api.<dominio>`) |

**CORS (apps/api)**: el `/login` se llama desde el navegador del dominio
tienda → el origen del panel (ej. `https://panel.<dominio>`) debe estar en
`ALLOWED_ORIGINS`. En dev, localhost ya está.

**Vercel (preview/demo)**: NO hace falta nada — con `DEMO_MODE=true` el
middleware deja pasar y el panel muestra la demo.

## 4. Pruebas

1. **Panel demo (sin backend)**: `pnpm --filter @nexora/tienda dev`,
   abrir `http://127.0.0.1:3001/panel/pedidos` → entra directo (DEMO_MODE=true).
2. **Guard real**: `.env.local` con `DEMO_MODE=false` y una
   `JWT_PUBLIC_KEY` → `http://127.0.0.1:3001/panel/pedidos` redirige a
   `/login?next=/panel/pedidos`.
3. **Login feliz** (stack local arriba + usuario con tienda provisionada):
   desde `/login`, credenciales → entra y ve su/sus pedidos (tenant propio).
4. **Aislación N1**: con sesión de otro tenant, las URLs del panel nunca
   muestran datos ajenos (no hay parámetro slug: el comercio viene del JWT).

## 5. Límites conocidos / Fase 1.6 (refresco y multi-usuario)

- **Sesión = access token**: cuando vence (`accessTtl` de apps/api) el dueño
  vuelve a login. Fase 1.6: refresh token + rol/permiso (`users.role`) para
  empleados del mostrador.
- Si un tenant tuviera 2 comercios, `getTiendaPorTenantId` trae el primero —
  MVP: 1 usuario–vendedor ↔ 1 tenant ↔ 1 comercio (precondición misma del funnel).
- `(demo)` `/panaderia` y `/quiero-tienda` siguen públicos: OK por diseño.
