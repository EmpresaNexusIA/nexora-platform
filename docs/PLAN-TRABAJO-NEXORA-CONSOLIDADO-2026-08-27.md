# PLAN DE TRABAJO Y HISTORIAL CONSOLIDADO — NEXORA

**Fecha de corte:** 27/08/2026  
**Fuente de verdad:** estado verificado en máquina + GitHub + pruebas ejecutadas.  
**Regla:** este archivo prevalece sobre memorias anteriores cuando haya contradicciones.

---

## 1. Qué es Nexora

Nexora Platform es una plataforma SaaS **self-hosted y multi-tenant** para vender **empleados digitales** a pymes.

Un empleado digital no es solamente un chatbot. Tiene:

- identidad;
- permisos;
- objetivos;
- herramientas autorizadas;
- límites;
- trazabilidad;
- autonomía graduada;
- supervisión humana cuando corresponde.

**Filosofía:** potente por dentro, simple por fuera.

**Pregunta filtro:**

> ¿Esto acerca a una empresa real a tener un empleado digital?

Origen: Rosario, Santa Fe, Argentina. Cliente inicial: pymes. Alcance: multi-vertical.

---

## 2. Decisiones arquitectónicas principales

- Monorepo pnpm con `apps/`, `packages/` y `shared/`.
- PostgreSQL multi-tenant con `tenant_id`, RLS y `FORCE ROW LEVEL SECURITY`.
- API Fastify con `api_user` y `NOBYPASSRLS`.
- Migraciones como única fuente de evolución de base de datos.
- Runner oficial: `node migrate.mjs`.
- `drizzle-kit migrate` prohibido por incidente de silent failure.
- Redis para refresh tokens, rate limit y gates de activación.
- Traefik como puerta HTTP/HTTPS.
- Outbox, DLQ e idempotencia.
- Autonomía graduada del empleado digital: A0 → A3.
- Apps nunca como `postgres`.
- API nunca como `nexora_admin`.

ADRs relevantes: 0003 RLS, 0004 monorepo, 0005 multi-vertical, 0006 Traefik, 0007 límites apps/packages, 0008 permisos versionados, 0009 API y frontera runtime, 0010 onboarding, 0011 Agent Runtime/Web Builder archivado.

---

## 3. Historial de trabajo

### 3.1 Fase A — certificación de la base

Fase A cerrada **8/8**:

- stop fix;
- hash de entregas;
- CI de Compose;
- Documento Maestro;
- prueba multi-tenant E2E;
- runtime con `api_user`;
- aislamiento A/B;
- backup y restore.

### 3.2 API B1

Construida y validada con:

- Fastify 5;
- Zod;
- JWT RS256;
- access token de 15 minutos;
- refresh token de 7 días en Redis;
- cookies HttpOnly;
- Bearer token;
- rate limit de login;
- `/health`, `/health/live`, `/health/ready`;
- `/login`, `/refresh`, `/logout`;
- `/me`, `/tenants/me`.

Se probó aislamiento entre Nexora y Acme: el cruce de tenant terminó en `404` correctamente.

### 3.3 Seguridad y credenciales

- Se eliminaron URLs hardcodeadas.
- Se rotaron credenciales de `nexora_admin` y `api_user`.
- `.env` ignorado por Git.
- Clave privada JWT con permisos `600`.
- Clave pública JWT con permisos `664`.
- Secretos fuera de Git, chats y logs.

### 3.4 Migración 0009 y RBAC

La migración `0009` dejó:

- RBAC deduplicado;
- PK compuesta en `roles_to_permissions`;
- `api_user` sin acceso directo al RBAC;
- `api_user` sin acceso directo al CRM;
- seed bloqueado salvo autorización explícita;
- integridad de roles y permisos.

Commit histórico de master antes del onboarding: `5c15720`.

### 3.5 Onboarding 0010

El bloque 0010 incorporó:

- vínculo CRM → tenant;
- `clientes.provisioned_tenant_id`;
- estados de onboarding;
- restricciones y checks;
- comparación de email case-insensitive;
- `complete_client_activation()`;
- token de activación de un solo uso;
- consumo Redis Lua atómico;
- TTL de 48 horas;
- reenvío que invalida el token anterior;
- provisioning transaccional;
- locks Redis NX;
- rate limit;
- respuesta indistinguible;
- anti-timing;
- rollback total;
- tests de ACL, unicidad y activación atómica.

Se realizó staging end-to-end: provisioning → activación → anti-reuso → login → limpieza.

El onboarding 0010 fue mergeado legítimamente en otra sesión con autorización del fundador. Commit previo de master: `2d29e84`.

### 3.6 ACL de la función de activación

Una consulta inicial produjo `0|1|1|1`, pero el último valor era un falso positivo de la consulta: buscaba cualquier ACL con `=X`, no específicamente `PUBLIC`.

La ACL real fue:

```text
nexora_admin:EXECUTE, api_user:EXECUTE
```

Resultado correcto:

- `api_user`: EXECUTE ✅
- `nexora_admin`: EXECUTE como propietario ✅
- `PUBLIC`: sin EXECUTE ✅

### 3.7 Backup post-0010

El backup anterior más reciente era del 20/08, previo al 0010. Se generó uno nuevo:

```text
nexora_dev_20260826_110118.sql
nexora_roles_20260826_110118.sql
```

Ubicación:

```text
~/Escritorio/Nexora/N. Respaldo/
```

Características:

- dump de base: 43K;
- dump de roles: 1,5K;
- headers pg_dump y pg_dumpall verificados;
- dump y roles juntos;
- restore posterior probado.

### 3.8 Restore

Se utilizó la urna descartable `nexora_restore_test`.

Resultado:

```text
11 PASS · 0 FAIL
```

Se verificaron migraciones, policies, tablas, RLS/FORCE, outbox, grants, RBAC y ausencia de grants directos indebidos. La urna fue eliminada y la base viva quedó intacta.

### 3.9 Prueba de oro

Se creó la base descartable `nexora_gold_test` y se ejecutó el runner oficial desde una base vacía:

```text
DATABASE_URL=... node migrate.mjs
```

Resultado:

```text
[migrate] OK — migraciones aplicadas correctamente.
11|7|6
```

La base descartable fue eliminada correctamente.

### 3.10 API Docker y Traefik

Se incorporaron:

- `apps/api/Dockerfile`;
- `infra/api/compose.yaml`;
- `.dockerignore`;
- inclusión de la API en `infra/compose.yaml`;
- healthcheck actualizado de 6 a 7 servicios.

Problemas resueltos:

1. Faltaba copiar `tsconfig.base.json` al build.
2. `tsconfig.tsbuildinfo` impedía generar `dist`; se excluyó y se elimina antes de compilar.
3. CI no tenía secretos locales; `secrets/api-container.env` pasó a `required: false`.
4. `depends_on` hacía fallar la validación individual del Compose de API; se eliminó.
5. Traefik necesitaba `secrets/traefik.env` para el dashboard; se creó con permisos `600`.
6. El hash `$apr1$...` necesitó escape de `$` para Compose.

Evidencia final:

- imagen `infra-api` construida;
- `@nexora/context/dist/index.js` presente;
- contenedor `nexora_api` saludable;
- API directa: HTTP 200;
- API vía Traefik HTTPS: HTTP 200;
- dashboard Traefik sin credenciales: HTTP 401;
- siete contenedores exactos;
- healthcheck B1: 11/11.

### 3.11 PR y merge de infraestructura

Rama:

```text
feat/infra-api-docker-20260827
```

Commits:

```text
e589439 feat(infra): containerize API and register seventh service
ee09518 fix(infra): allow compose validation without local secrets
98b8832 fix(infra): keep API compose independently valid
```

PR #2 mergeado en `master`:

```text
50bc33d Merge pull request #2 from EmpresaNexusIA/feat/infra-api-docker-20260827
```

CI final:

- `lint`: verde;
- `validate-compose`: verde.

---

## 4. Estado real actual

### Git

```text
master = 50bc33d
```

Árbol local limpio al cierre de la sincronización.

### Base y organismo

```text
DNI: 7670634338808201248
Pulso: 3|0|6|7|11
Healthcheck B1: 11/11
```

### Siete servicios activos

1. `nexora-postgres`
2. `nexora_traefik`
3. `nexora_whoami`
4. `nexora-redis`
5. `nexora-minio`
6. `nexora-qdrant`
7. `nexora_api`

### API

- Corre en Docker.
- Escucha internamente en `0.0.0.0:3001`.
- Publica localmente `127.0.0.1:3001`.
- Usa `api_user`.
- Usa Redis y JWT RS256.
- Tiene healthcheck Docker.
- Está publicada detrás de Traefik HTTPS.

---

## 5. Pendientes y plan completo

### Paso 1 — Normalizar proyectos Compose

Existe una advertencia conocida:

```text
volume "nexora_redis_data" already exists but was created for project "nexora-redis" (expected "infra")
```

Causa: los servicios históricos usan nombres de proyecto Compose separados, mientras que el Compose raíz se evalúa como proyecto `infra`.

Actualmente la API se pudo levantar con:

```text
docker compose ... up -d --no-deps api
```

Objetivo:

- que el Compose raíz administre los 7 servicios;
- que no intente recrear Redis o PostgreSQL;
- eliminar warnings de proyectos y volúmenes;
- no borrar contenedores;
- no borrar volúmenes;
- no usar `docker compose down` a ciegas;
- no tocar secretos ni datos.

### Paso 2 — Cerrar documentación en el repo

El MAPA v7 y el Addendum 26 ya están generados en el workspace. Falta decidir si se incorporan al repositorio mediante una rama y PR documental.

Documentos generados:

- `MAPA-GENERAL-NEXORA-v7-2026-08-27.md`;
- `ADDENDUM-26-2026-08-27.md`.

### Paso 3 — Autorización del fundador

Implementar y validar el permiso:

```text
platform:onboarding
```

Debe permitir:

- distinguir fundador de usuario normal;
- proteger operaciones administrativas;
- auditar quién autorizó;
- impedir privilegios administrativos amplios en runtime.

### Paso 4 — Roles runtime mínimos

Separar definitivamente:

- Ojo;
- Worker;
- Encargado;
- API;
- migraciones;
- administración.

Cada proceso debe tener credenciales mínimas y separadas.

### Paso 5 — Panel del fundador

Panel interno con datos reales:

- tenants;
- clientes CRM;
- onboarding;
- activaciones;
- actividad;
- errores;
- outbox;
- DLQ;
- empleados digitales;
- autorizaciones;
- auditoría.

### Paso 6 — Web Factory MVP

ADR-0011 sigue archivado y no debe implementarse antes de autorización, roles y panel.

El MVP deberá incluir:

- vertical inicial;
- componentes reutilizables;
- generación de webs;
- export estático;
- dominio del cliente;
- HTTPS;
- aislamiento de red;
- Playwright;
- Axe;
- Lighthouse;
- provenance;
- política de integridad de datos;
- prohibición de inventar datos.

### Paso 7 — Primer piloto y VPS

Secuencia:

1. elegir vertical;
2. elegir caso de uso concreto;
3. preparar piloto real;
4. desplegar VPS;
5. conectar dominio del cliente;
6. configurar HTTPS;
7. probar aislamiento;
8. medir resultados;
9. documentar errores;
10. graduar autonomía.

### Paso 8 — Primer cliente pago

El primer cliente debe entrar por el onboarding 0010 y convertirse en una validación comercial y técnica real.

---

## 6. Frente comercial paralelo

No debe esperar a que termine toda la plataforma.

Ya existen:

- 23 leads de Rosario;
- guiones;
- Spoki;
- materiales de ventas;
- propuestas de webs;
- propuestas de bots;
- combos;
- chat comercial separado.

Secuencia:

1. contactar los 23 leads;
2. detectar problema concreto;
3. ofrecer solución simple;
4. vender web, bot o combo;
5. convertir el primer cliente;
6. hacerlo entrar por onboarding 0010;
7. medir resultado;
8. usarlo como caso real;
9. repetir.

Reglas comerciales:

- no prometer magia;
- no vender autonomía inexistente;
- precios razonables;
- dominio del cliente;
- seguridad por red;
- webs únicas;
- bots v1 sobre Spoki;
- cobrar por valor real.

---

## 7. Orden ejecutivo resumido

### Completado

- Fase A 8/8 ✅
- API B1 ✅
- RLS y aislamiento multi-tenant ✅
- credenciales rotadas ✅
- RBAC 0009 ✅
- onboarding 0010 ✅
- staging end-to-end ✅
- merge 0010 ✅
- backup post-0010 ✅
- restore probado ✅
- prueba de oro ✅
- API Docker ✅
- Traefik ✅
- séptimo servicio ✅
- healthcheck 11/11 ✅
- CI ✅
- documentación v7 y Addendum 26 ✅

### Próximo orden

1. Normalizar proyectos Compose.
2. Incorporar documentación al circuito del repo.
3. Implementar `platform:onboarding`.
4. Crear roles runtime mínimos.
5. Construir panel del fundador.
6. Definir y construir Web Factory MVP.
7. Preparar primer piloto.
8. Desplegar VPS.
9. Conectar primer cliente real.
10. Continuar prospección comercial en paralelo.

---

## 8. Reglas operativas permanentes

- Un comando por vez.
- Cada bloque Bash termina con `# FIN` dentro del bloque.
- `# FIN` es un comentario Bash y no genera error.
- Cero suposiciones.
- Validar antes de avanzar.
- No push directo a `master`.
- Cambios importantes por rama y PR.
- Secretos fuera de Git, chats y logs.
- No leer ni pegar `.env`.
- No usar `drizzle-kit migrate`.
- Apps nunca como `postgres`.
- API nunca como `nexora_admin`.
- Backup con dump y roles.
- Restore probado.
- Cuarentena antes que DROP.
- No borrar contenedores ni volúmenes por intuición.
- Un solo engine Docker y un solo protagonista por proceso.
- Menos piezas, más evidencia.
- La pregunta filtro manda.

---

## Resumen final

Nexora ya tiene una base técnica certificada, onboarding seguro, API B1, aislamiento multi-tenant, backup y restore verificados, prueba de oro con 11 migraciones, API Docker, Traefik, siete servicios saludables y CI verde.

El siguiente salto no es agregar tecnología por agregar: es ordenar la operación Compose, separar autorización y roles runtime, construir el panel del fundador y convertir esta plataforma en un piloto real que produzca el primer cliente pago.
