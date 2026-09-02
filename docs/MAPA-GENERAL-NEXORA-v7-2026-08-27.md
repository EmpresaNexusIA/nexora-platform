# 🗺️ MAPA GENERAL DE NEXORA — v7

> Estado documentado al **27 de agosto de 2026**. Esta versión reemplaza al MAPA v6 cuando haya contradicciones.
>
> Fase A cerrada · onboarding 0010 mergeado · backup y restore verificados · prueba de oro aprobada · API Docker operativa · Traefik operativo · salud B1 11/11.

---

# 1. QUÉ ES NEXORA

Nexora Platform es una plataforma SaaS self-hosted y multi-tenant para vender **empleados digitales** a pymes.

- Origen: Rosario, Santa Fe, Argentina.
- Filosofía: **potente por dentro, simple por fuera**.
- Pregunta filtro: **“¿Esto acerca a una empresa real a tener un empleado digital?”**
- Aislamiento: PostgreSQL RLS, `tenant_id`, policies FORCE y API con `api_user` NOBYPASSRLS.

---

# 2. ESTADO ACTUAL — 27/08/2026

## 2.1 Git y entrega 0010

- Repositorio: `EmpresaNexusIA/nexora-platform`.
- `master`: **`50bc33d`** — merge del PR #2.
- Rama de trabajo: `feat/infra-api-docker-20260827`.
- PR #2: containerización de API y registro del séptimo servicio.
- CI del PR: `lint` y `validate-compose` verdes.
- Árbol local limpio después de sincronizar `master`.

## 2.2 Pulso y salud

- Pulso: **`3|0|6|7|11`**.
- DNI del organismo: `7670634338808201248`.
- Healthcheck B1: **11/11**.
- Contenedores: **7 y solo 7**.
- API: contenedor `nexora_api`, saludable.

## 2.3 Los 7 servicios

1. `nexora-postgres`
2. `nexora_traefik`
3. `nexora_whoami`
4. `nexora-redis`
5. `nexora-minio`
6. `nexora-qdrant`
7. `nexora_api`

La API está publicada localmente en `127.0.0.1:3001` y escucha internamente en `0.0.0.0:3001`.

---

# 3. BLOQUE 0010 — ONBOARDING

Estado: **cerrado y mergeado**.

- Staging end-to-end realizado: provisioning → activación → anti-reuso → login.
- Función `public.complete_client_activation(...)` validada.
- `api_user` tiene `EXECUTE`.
- `PUBLIC` no tiene `EXECUTE`.
- `nexora_admin` conserva el permiso de propietario, como corresponde.
- Token de un solo uso con consumo atómico Redis Lua.
- Backup post-0010 creado el 26/08/2026.
- Restore probado: **11 PASS · 0 FAIL**.
- Prueba de oro desde base vacía: **11 migraciones aplicadas correctamente**.
- Conteo estructural de prueba de oro: **`11|7|6`**.

## ACL — aclaración de la prueba

Una consulta inicial devolvió `0|1|1|1`, pero el último `1` era un falso positivo: la consulta buscaba cualquier ACL con el patrón `=X`, no específicamente el grantee `PUBLIC`.

La ACL real fue:

```text
nexora_admin:EXECUTE, api_user:EXECUTE
```

No apareció `PUBLIC:EXECUTE`.

---

# 4. API B1 EN DOCKER

## Evidencia operativa

- Imagen construida: `infra-api`.
- `@nexora/context` compila dentro de la imagen.
- Se excluyen secretos, claves, `node_modules`, `dist`, backups y `tsbuildinfo` mediante `.dockerignore`.
- Health del contenedor: `healthy`.
- API directa: HTTP 200 en `/health/live`.
- API vía Traefik HTTPS: HTTP 200.
- Dashboard Traefik sin credenciales: HTTP 401.
- API utiliza `api_user`, PostgreSQL y Redis.
- Claves JWT montadas como volumen de solo lectura.

## Archivos incorporados

- `apps/api/Dockerfile`
- `infra/api/compose.yaml`
- `.dockerignore`
- inclusión de `infra/api/compose.yaml` en `infra/compose.yaml`
- `infra/scripts/healthcheck.sh` actualizado de 6 a 7 servicios

---

# 5. BACKUP Y RESTORE

Backup post-0010:

- Dump: `nexora_dev_20260826_110118.sql`
- Roles: `nexora_roles_20260826_110118.sql`
- Ubicación: bóveda offline `~/Escritorio/Nexora/N. Respaldo/`
- Dump: 43K.
- Roles: 1,5K.
- Restore: urna descartable `nexora_restore_test`.
- Resultado: **11 PASS · 0 FAIL**.
- Urna eliminada; base viva intacta.

---

# 6. COMPOSE — NOTA OPERATIVA

La API está integrada como séptimo servicio y funciona con la red externa `nexora_net`.

Queda una tarea de higiene pendiente: los servicios históricos usan nombres de proyecto Compose separados (`nexora-postgres`, `nexora-redis`, etc.), mientras que el Compose raíz se evalúa como proyecto `infra`. Por eso una invocación raíz que intente gestionar dependencias puede advertir sobre volúmenes existentes o intentar recrear contenedores ya vivos.

Durante la transición se utilizó:

```text
docker compose ... up -d --no-deps api
```

La normalización de proyectos Compose queda pendiente y debe hacerse sin borrar contenedores ni volúmenes.

---

# 7. QUÉ FALTA — COLA VIGENTE

1. **Documentación de este hito** — en curso, esta versión la consolida.
2. **Normalización segura de proyectos Compose** — pendiente, no bloquear la operación actual.
3. Autorización del fundador: `platform:onboarding`.
4. Roles runtime mínimos para Ojo, Worker y Encargado.
5. Panel del fundador con tenants, onboarding, actividad y CRM.
6. Web Factory MVP según ADR-0011.
7. Primer piloto y VPS.
8. Primer cliente pago por onboarding 0010.

ADR-0011 continúa archivado: no implementar el runtime/Web Builder antes de cerrar autorización, roles y panel.

---

# 8. REGLAS DE OPERACIÓN

- Un comando por vez, con resultado esperado.
- `# FIN` dentro de los bloques Bash para marcar el final pegable sin ejecutarse.
- Cero suposiciones; evidencia antes de tocar.
- No push directo a `master`.
- Secretos fuera de Git, chats y logs.
- No usar `drizzle-kit migrate`; runner oficial: `node migrate.mjs`.
- Apps nunca como `postgres`; API nunca como `nexora_admin`.
- Backups con dump + roles y restore probado.
- Cuarentena antes que DROP, salvo urnas explícitamente descartables.
- Un solo engine Docker y un solo protagonista por proceso.

---

*MAPA v7 generado el 27/08/2026 después del merge del PR #2 y de la certificación operativa de la API Docker.*
