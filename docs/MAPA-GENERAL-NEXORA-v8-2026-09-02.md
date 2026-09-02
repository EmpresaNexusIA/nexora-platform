# 🗺️ MAPA GENERAL DE NEXORA — v8

> Estado documentado al **2 de septiembre de 2026**. Esta versión reemplaza al MAPA v7 cuando haya contradicciones.
>
> Fase A cerrada · onboarding 0010 certificado · API Docker operativa · **Fase 2 cerrada: identidad de plataforma certificada con prueba de oro** · salud 10/10 · pulso sagrado `3|0|6|7|12`.

---

# 1. QUÉ ES NEXORA

Nexora Platform es una plataforma SaaS self-hosted y multi-tenant para vender **empleados digitales** a pymes.

- Origen: Rosario, Santa Fe, Argentina.
- Filosofía: **potente por dentro, simple por fuera**.
- Pregunta filtro: **“¿Esto acerca a una empresa real a tener un empleado digital?”**
- Aislamiento: PostgreSQL RLS, `tenant_id`, policies FORCE y API con `api_user` NOBYPASSRLS.

---

# 2. ESTADO ACTUAL — 02/09/2026

## 2.1 Git y entregas

- Repositorio: `EmpresaNexusIA/nexora-platform` (público por acceso de Jules; pendiente evaluar repo privado + GitHub App con acceso por repo seleccionado).
- `master`: **`1f3fb43`**.
- **PR #3 mergeado: `a34c8b7`** — Fundación de identidad de plataforma (migración 0012 + bootstrap reproducible). 6 archivos, +226/−2. CI: lint y validate-compose verdes.
- **PR #4 mergeado: `1f3fb43`** — `healthcheck.sh`: `PULSO_ESPERADO` actualizado a `3|0|6|7|12` (1 línea).
- Árbol local sincronizado y limpio; ramas de trabajo eliminadas local y remoto.
- Autoría preservada: commits de código firmados por `google-labs-jules[bot]`; cherry-picks sobre rama limpia desde `master`.

## 2.2 Pulso y salud

- Pulso sagrado: **`3|0|6|7|12`** (`outbox|dlq|triggers|policies|migraciones`).
- DNI del organismo: `7670634338808201248` — íntegro.
- Salud: **10/10** (perfil base, 02/09 10:14) — motor Docker, 7/7 contenedores, Postgres, puerta web, recursos, Redis, MinIO y Qdrant verdes.
- Contenedores: **7 y solo 7**.

## 2.3 Los 7 servicios (sin cambios)

1. `nexora-postgres`
2. `nexora_traefik`
3. `nexora_whoami`
4. `nexora-redis`
5. `nexora-minio`
6. `nexora-qdrant`
7. `nexora_api`

---

# 3. FASE 2 — IDENTIDAD DE PLATAFORMA (CERRADA EL 02/09/2026)

## 3.1 Qué se construyó

**Migración `0012_platform_identity_permissions.sql`** (índice de journal 11; la 0011 queda reservada a ADR-0011):

- 7 permisos explícitos de plataforma en `public.permissions`:

```text
platform:control:read
platform:control:manage
platform:onboarding
platform:runtime:read
platform:runtime:manage
platform:backup:read
platform:events:read
```

- Rol global `Platform Founder` en `public.roles` con `tenant_id IS NULL` (rol de sistema, no atado a tenant comercial).
- 7 vínculos rol ↔ permiso en `public.roles_to_permissions`.
- **La migración NO asigna el rol a ningún usuario**: la asignación es responsabilidad del bootstrap.
- Idempotente: `ON CONFLICT DO NOTHING` y guarda `WHERE NOT EXISTS` en las tres inserciones.

**Bootstrap reproducible (`infra/scripts/create-admin.sh`)**:

- Guarda explícita: si el rol `Platform Founder` no existe, aborta con `Falta aplicar migración 0012` **sin escribir nada** (transacción abortada).
- Asignación dinámica: `JOIN` al rol global y `ON CONFLICT (email) DO UPDATE SET role_id` — funciona en base nueva y también actualiza un admin preexistente con `role_id NULL`.
- La autorización proviene del **rol**, nunca del email hardcodeado.
- Corre como `nexora_admin` vía `docker exec`; nunca desde la API.
- Configurable por entorno: `NEXORA_POSTGRES_CONTAINER`, `NEXORA_DB_ADMIN_USER`, `NEXORA_DB_NAME`. Su default de base es `nexora_dev` (la base viva): para pruebas usar siempre `NEXORA_DB_NAME=<urna>`.

**Soporte de código**: constantes `PLATFORM_PERMISSIONS` y tipo `PlatformPermission` en `packages/database/src/platform-permissions.ts`, re-exportados desde el índice del paquete.

**Suite**: `packages/database/src/__tests__/platform-identity.test.ts` — 6 tests (1 unitario + 5 de integración con `runIf` sobre `DATABASE_ADMIN_URL` / `DATABASE_API_URL`), incluyendo negativo de usuario comercial y verificación de `NOBYPASSRLS`. Cleanup por transacción `BEGIN`/`ROLLBACK` (sin DELETE físico).

## 3.2 Evidencia — prueba de oro (02/09)

Ejecutada en urna descartable `nexora_gold_0012` sobre Postgres certificado, **con aplicación incremental 0000→0012** (la forma exacta en que se aplica en producción):

- `node migrate.mjs`: `OK` — aplicó solo 0012 sobre las 11 existentes.
- Firma estructural: **`12|7|6`** (migraciones 12 · policies 7 · triggers 6 — policies y triggers intactos).
- SELECTs de la verdad: **7 permisos / 1 rol global / 7 vínculos**.
- Control negativo previo: urna sin el archivo 0012 → instrumento marcó `0/0/0` (instrumento calibrado antes del positivo).
- Guard-test negativo: base con solo 0000–0010 + script nuevo → aborta con el mensaje diseñado, cero escrituras.
- Bootstrap ×2 contra la urna: idempotente, `role_name = Platform Founder`, sin duplicados.
- Suite: **6 passed / 0 skipped / 0 failed**.
- Hallazgo de auditoría: el trigger anti-DELETE físico de Nexora Core **rechazó en vivo** el cleanup original del test (`Las eliminaciones físicas están prohibidas en Nexora Core`); fix con patrón transaccional (commit `719f48b`).
- Revisión automática de Codex en el PR detectó de forma independiente el P2 del contador de pulso del healthcheck → originó PR #4.

## 3.3 Producción local

- `0012` aplicada a la base viva con el runner oficial: pulso migraciones `11 → 12`.
- Bootstrap real: **`admin@nexora.local` con rol `Platform Founder`** en el tenant de plataforma `00000000-0000-7000-8000-000000000001`.
- `users.tenant_id` obligatorio + `roles.tenant_id IS NULL` global: contrato JWT intacto (el fundador pertenece al tenant de plataforma; la autorización por permisos se resolverá en la capa RBAC — PR 2 — no como claims del JWT).
- RLS y `NOBYPASSRLS` de `api_user`: intactos.

## 3.4 Backup post-0012

- `nexora_dev_20260902_101800.sql` (48K) + `nexora_roles_20260902_101800.sql` (1,5K).
- Headers pg_dump / pg_dumpall verificados. Bóveda offline `~/Escritorio/Nexora/N. Respaldo/`.

## 3.5 Limpieza de obra

- Urna `nexora_gold_0012` eliminada; mini-urna negativa `nexora_gold_neg` eliminada.
- Ramas locales `pr-0012` y `feat/0012-platform-identity` eliminadas; rama remota de sesión de Jules eliminada del remoto.

---

# 4. LECCIONES INCORPORADAS AL PROTOCOLO DE TRABAJO

Reglas nuevas, ganadas con evidencia durante la Fase 2:

1. **Un PR no existe hasta que `git ls-remote origin` muestra su ref.** El reporte del agente sobre rama/PR/CI es una declaración; la ref remota es el hecho. (La entrega de PR 1 estuvo "lista" en el sandbox de Jules sin existir jamás en GitHub; el pipeline lo detectó antes del merge.)
2. **Toda verificación de un PR empieza confirmando que el árbol local está parado sobre la rama del PR.** (Una prueba de oro inicial midió `master` sin querer.)
3. **Los archivos largos viajan como archivos o por git, nunca por portapapeles.** Los heredoc de varios KB saturan el pty y se entrelazan. Método certificado: archivo → descarga → `cp` → verificación por greps.
4. **Control negativo antes que positivo**: el instrumento de medición debe demostrar primero que detecta la ausencia (`0/0/0`); solo entonces el positivo (`7/1/7`) tiene credibilidad.
5. Codex (`chatgpt-codex-connector`) queda habilitado como revisor automático adicional en PRs; su P2 sobre el pulso del healthcheck convergió con la revisión humana.

---

# 5. COLA VIGENTE

1. **Documentación al circuito del repo** (por PR): MAPA v7, Addendum 26, **MAPA v8**, protocolo de trabajo con Jules, plan Nexora Control y 0011, `STAGING-0010.md`, `RUNBOOK-ACTIVACION.md`, `OPENAPI-ONBOARDING.yaml`, ADR-0011.
2. **Normalización segura de proyectos Compose** — pendiente, no bloqueante (warnings de volúmenes históricos; sin `docker rm`, sin borrar volúmenes).
3. **PR 2 — Middleware RBAC de plataforma** (`requirePlatformPermission`, pruebas negativas 401/403, resolución de permisos en capa API). Con auditoría previa según protocolo.
4. **Roles runtime mínimos** para Ojo, Worker y Encargado.
5. **Nexora Control V1** — panel privado del fundador: API `/platform` de solo lectura → `apps/control` → SSE con fallback a polling → acciones administrativas auditadas (PRs 3 a 6 del plan).
6. **ADR-0011 por tajadas** — permanece archivado hasta cerrar autorización y panel.
7. Web Factory MVP, primer piloto + VPS, primer cliente pago por onboarding 0010.
8. Frente comercial en paralelo: 23 leads de Rosario (sin cambios).

---

# 6. REGLAS DE OPERACIÓN

Sin cambios respecto al v7, más las cinco lecciones de la sección 4:

- Un comando por vez, con resultado esperado y `# FIN` dentro del bloque.
- Cero suposiciones; evidencia antes de avanzar.
- No push directo a `master`; cambios por rama y PR.
- Secretos fuera de Git, chats y logs; no leer ni pegar `.env`.
- Migraciones como única fuente de evolución de base; runner oficial `node migrate.mjs`; `drizzle-kit migrate` prohibido.
- Apps nunca como `postgres`; API nunca como `nexora_admin`.
- Backup con dump y roles; restore probado; cuarentena antes que DROP (salvo urnas explícitamente descartables).
- Un solo engine Docker y un solo protagonista por proceso.
- Eliminaciones físicas prohibidas en Core (soft-delete con `deleted_at`) — verificado en vivo durante la Fase 2.
- Menos piezas, más evidencia. La pregunta filtro manda.

---

*MAPA v8 generado el 02/09/2026 tras el merge de los PR #3 y #4, la prueba de oro de la migración 0012 y la certificación del pulso `3|0|6|7|12`. El organismo Nexora queda con identidad de plataforma formal, fundador con rol global reproducible y documentación al día.*

*Próximo paso: auditoría y plan de PR 2 — middleware RBAC de plataforma.*
