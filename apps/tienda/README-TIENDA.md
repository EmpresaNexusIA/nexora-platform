# @nexora/tienda — la app del comercio (Next.js 14 App Router)

El **producto de cara al cliente final y al comercio**, dentro del monorepo.
SSR para SEO de las tiendas públicas, panel móvil-first para el vendedor.

## Rutas

| Ruta | Descripción |
|---|---|
| `/` | Landing de adquisición (leads → `crm/clientes` vía API, Fase 1) |
| `/t/[slug]` | Tienda pública de un comercio ( + manifest PWA ) |
| `/pedido/[token]` | Seguimiento del pedido para el cliente (link no adivinable) |
| `/panel/*` | Pedidos · Catálogo (fotos + stock) · Caja (CSV) · Clientes VIP · Config |
| `/api/assistant` | Chat dual: ayuda al cliente y asistente del vendedor |
| `/api/reporte` | CSV cierre de caja (separador `;`, BOM para Excel) |
| `/api/upload` | Fotos de producto (MinIO con fallback local) |

## Capas de datos (switch por env, sin tocar UI)

| Modo | Qué pasa |
|---|---|
| `DEMO_MODE=true` | `src/lib/data/demo.ts` en memoria (preview sin backend) |
| `DEMO_MODE=false` | `src/lib/data/platform.ts` → Postgres del monorepo + funciones de `packages/database/sql/0010_tienda_domain.sql` |

El contrato único (`NexoraDB` en `src/lib/data/adapter.ts`) es el mismo para
todas las capas. Reglas N1–N15 viven en servidor (RPC `crear_pedido`,
trigger tope 30 productos, RLS por `current_setting('app.tenant_id')`).

## Dev

```bash
# parado en la raíz del repo (Ubuntu WSL):
pnpm install
pnpm --filter @nexora/tienda dev
# o en demo sin DB:
DEMO_MODE=true pnpm --filter @nexora/tienda dev
```

Tienda demo: `/t/panaderia-maria` · Panel: `/panel/pedidos`.

Orden para producción:
1. `cd packages/database && pnpm db:generate && pnpm db:migrate` (schemas tienda)
2. `psql "$DATABASE_ADMIN_URL" -f packages/database/sql/0010_tienda_domain.sql`
3. Configurar `.env` (ver `.env.example`)
4. Deploy Vercel → Root Directory `apps/tienda`

## Seguridad ya bancada

- RLS por tenant (`apps/api` setea `app.tenant_id` con `SET LOCAL`)
- Dinero solo en servidor (números del RPC, nunca del front)
- Ítems congelados · anti-spam (3 pendientes/teléfono) · tope plan Gratis en trigger
- % VIP oculto al cliente · link de pedido con token no adivinable

Ver `docs/tienda/PLAN-MERGE-TIENDA.md` para el lineamiento completo.
