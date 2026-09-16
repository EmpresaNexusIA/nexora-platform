# PLAN DE MERGE · Tienda (app comercio) dentro de nexora-platform

**Fecha:** 2026-09-15 · **Decisiones:** auth = apps/api (Fastify+JWT+tabla users) ·
schemas tienda en Drizzle · app Next.js como `apps/tienda` · notificaciones por
orchestrator (Telegram) o ntfy.sh · fotos en MinIO.

## Por qué así (registro de la decisión)

La plataforma (`EmpresaNexusIA/nexora-platform`) ya resuelve tenants, RBAC,
CRM de leads, orchestración con DLQ e infra Docker (Postgres/Redis/MinIO/
Qdrant/Traefik). La **capa que faltaba** es la vendible: tienda pública,
checkout, panel del comercio. Se construyó como app Next.js aislada y se
integra al monorepo sin cambiar ninguna decision previa:

- `apps/*` ya está en `pnpm-workspace.yaml` → solo se agrega la carpeta.
- Nada rompe el bot en producción ni el resto de sub-proyectos.

## Qué agrega esta rama

```
apps/tienda/                       # app Next.js 14 completa (tienda + panel + checkout)
packages/database/
  drizzle/schema/tienda/*.ts       # 9 tablas de dominio (convención uuidv7 + auditFields)
  sql/0010_tienda_domain.sql       # crear_pedido() · cambiar_estado_pedido() · resumen_caja()
                                   # + RLS por app.tenant_id + trigger tope Plan Gratis
docs/tienda/PLAN-MERGE-TIENDA.md   # este doc
```

## Correspondencia de esquemas

| Plataforma (previo) | Tienda (nuevo) | Nota |
|---|---|---|
| `tenants` (slug, status) | `comercios` (tenant_id 1:1) | slug NO se duplica: lectura por JOIN |
| `users`+roles+permissions | — | el dueño del comercio = user del tenant | 
| `crm/clientes` (leads) | — | la landing `/` alimenta este CRM (Fase 1) |
| — | `categorias/productos/pedidos/items_pedido` | dominio vendible |
| — | `perfiles` (+`clientes_frecuentes`) | clientes FINAILEES — compran sin login (regla N2); jamás tabla `users` |
| — | `suscripciones` | cobro al comercio; Fase 2 webhook MP mueve `tenant.status` |
| — | `metricas_tienda` | stats por día por comercio |

## Convenciones heredadas y respetadas

- `primaryKeyUuidV7` + `auditFields` (`created_at/updated_at/deleted_at` + by) en todas las tablas tienda salvo `items_pedido` (solo PK).
- `uniqueIndex(...).where(deletedAt IS NULL)` para slugs/nombres — mismo patrón que `roles`.
- Soft-delete en todas las queries (`deleted_at IS NULL`).
- Sin `auth.users/auth.uid()` (eso era la variante Supabase): RLS se activa con `SET LOCAL app.tenant_id` desde `apps/api`.

## Reglas N1–N15 ya blindadas en servidor (no confiar en el front)

- N3 dinero solo servidor · N4 ítems congelados · N5 máquina de estados ·
  N6 dto con vigencia/tope/nunca sobre envío · N12 anti-spam 3 pendientes/teléfono ·
  N13 tope 30 productos plan Gratis (trigger `validar_limite_productos`) ·
  % VIP oculto al cliente.
- Verificación por pedido: probar `crear_pedido()` con fixtures en `tests/`.

## Pasos de instalación

```bash
# 1 · Dependencias de la app
pnpm install                       # instala también apps/tienda (pg, next, aws-sdk-s3)

# 2 · Migraciones drizzle de las 9 tablas tienda
cd packages/database
pnpm db:generate                   # genera migración nueva
pnpm db:migrate

# 3 · Funciones de negocio (SQL)
psql "$DATABASE_ADMIN_URL" -f packages/database/sql/0010_tienda_domain.sql

# 4 · Probar la app en demo (sin DB)
cd ../../apps/tienda
DEMO_MODE=true pnpm dev
# storefront: http://localhost:3001/t/panaderia-maria

# 5 · Contra tu Postgres local
cp .env.example .env.local && editar # DEMO_MODE=false + DATABASE_URL
pnpm dev
```

## Fases siguientes (en orden)

1. **Onboarding**: `apps/admin/scripts/provision-client.ts` + INSERT comercio al provisionar tenant → tienda activa con trial 14 días.
2. **Lead-in**: Landing `/` postea al endpoint de `crm/clientes` de apps/api.
3. **Auth panel**: login del dueño contra apps/api (JWT), middleware en apps/tienda validando `tenant_id` → `SET LOCAL app.tenant_id`.
4. **MinIO**: crear bucket `productos` + policy pública de lectura.
5. **Orchestrator**: handler `pedido.creado` (Telegram) ya disparado desde `crear_pedido()` (insert a `audit.outbox` — ajustar columnas si tu DDL difiere) y/o fallback `lib/notificar.ts` (ntfy.sh).
6. **Mercado Pago Suscripciones**: webhook → `suscripciones` + `tenants.status`.
7. **Asistente IA**: Qdrant para RAG por comercio; el chat ya tiene el contrato (`/api/assistant`, `buildSystemPrompt`).
