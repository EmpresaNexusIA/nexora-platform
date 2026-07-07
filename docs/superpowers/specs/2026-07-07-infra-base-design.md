# Diseño: Infraestructura base — Nexora Platform (sub-proyecto 1/9)

**Fecha:** 2026-07-07 (revisado el mismo día tras feedback del usuario)
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

Nexora-IA hoy corre como un bot (Telegram/WhatsApp) + panel en un VPS de Hostinger,
usando Supabase como base de datos hosteada. Este documento diseña la base de una
**nueva plataforma self-hosted** (`Nexora Platform`) pensada para eventualmente
reemplazar ese stack.

La plataforma **no se limita a negocios de servicios**. Está pensada para
atender cualquier tipo de cliente: comercios, distribuidoras, talleres,
profesionales independientes, industrias, instituciones y entidades públicas.
El modelo de datos (sub-proyecto 2) y los agentes de IA (sub-proyecto 5) deben
diseñarse pensando en verticales distintas desde el principio, no como un caso
particular de "negocio de servicios" extendido después.

No se toca el bot actual en producción durante este trabajo.

## Por qué esto se dividió en sub-proyectos

El pedido original cubre infraestructura base, aplicaciones, capa de datos,
automatización, mensajería, IA/RAG, scraping/testing, seguridad y
documentación — múltiples subsistemas en gran medida independientes.
Diseñarlos y planearlos todos juntos produce un spec ingobernable. Se decidió
trabajar cada uno como su propio ciclo diseño → spec → plan → implementación,
empezando por la infraestructura base porque todos los demás dependen de ella.

**Orden de sub-proyectos:**
1. **Infra base** (este documento) — Docker Compose, red, Traefik, secrets,
   scripts, monorepo, CI, ADRs.
2. Capa de datos — PostgreSQL multi-tenant, Redis, Qdrant, MinIO.
3. Motor de automatización — n8n.
4. Mensajería — Evolution API (WhatsApp), integración Telegram.
5. Capa de IA — prompts, knowledge, memoria, embeddings, agentes (`apps/agents`).
6. Aplicaciones — `apps/api`, `apps/admin`, `apps/web`.
7. Scraping/testing — Playwright, Firecrawl, tests de integración/e2e/carga.
8. Seguridad y operaciones — backups, monitoreo, logs, rotación de secretos.
9. Documentación — se escribe por capa, no como proyecto aparte.

`apps/agents` se construye en el sub-proyecto 5 (Capa de IA) porque su lógica
depende directamente de `ai/` (prompts, memoria, embeddings); `apps/api`,
`apps/admin` y `apps/web` son consumidores de esa capa y se agrupan en el
sub-proyecto 6.

## Decisiones de contexto (confirmadas con el usuario)

- **Relación con el stack actual:** esta plataforma es el diseño de la próxima
  versión de Nexora-IA, para reemplazar eventualmente Supabase. Arranca en
  desarrollo local (Windows + WSL2) y está pensada para escalar a un VPS propio
  sin rediseño.
- **Alcance de negocio:** multi-vertical desde el diseño — no solo negocios de
  servicios. Ver [ADR-0005](../architecture/decisions/0005-alcance-multivertical.md).
- **Multi-tenancy:** schema compartido en Postgres, todas las tablas con columna
  `tenant_id`, aislamiento vía Row-Level Security. Ver
  [ADR-0003](../architecture/decisions/0003-multi-tenant-schema-compartido-rls.md).
- **Entorno de desarrollo:** WSL2 con Ubuntu 22.04 como shell principal de
  trabajo — mismo SO que el VPS de producción actual.
- **Repositorio:** proyecto nuevo en `C:\Users\PC\Proyectos-Nexora\Nexora - Platform\`,
  con repo propio en GitHub (org `EmpresaNexusIA`, nombre sugerido
  `nexora-platform`), separado de `Nexora - Bot`.
- **Monorepo con pnpm workspaces (nuevo, ver justificación abajo).**
- **`apps/api` es el API Gateway y único punto de entrada público del producto**
  (web, admin, mobile futuro, integraciones, API pública futura). Orquesta y
  aplica reglas de negocio, no concentra toda la lógica del sistema. Ver
  [ADR-0006](../architecture/decisions/0006-api-gateway.md).

### Por qué pnpm workspaces para `apps/` y `shared/`

El pedido de una carpeta `shared/` con `types`, `schemas` y `libraries`
consumida por varias `apps/` (api, admin, web, agents) es, en los hechos, un
pedido de monorepo. Sin una herramienta de workspaces, `shared/` termina
copy-pasteado o enlazado a mano entre apps, que es exactamente el tipo de
deuda técnica que este proyecto busca evitar desde el día uno.

Se evaluaron 3 opciones:

- **npm workspaces** — ya viene con Node, cero dependencias nuevas, pero
  resolución de dependencias más lenta y menos estricta (permite "phantom
  dependencies").
- **pnpm workspaces (elegida)** — mismo modelo mental que npm workspaces, pero
  instalación más rápida y un `node_modules` estricto por paquete que evita
  que una app dependa "por accidente" de algo que no declaró. Es hoy el
  estándar de facto para monorepos de este tamaño.
- **Turborepo/Nx sobre pnpm** — agrega cacheo de builds y ejecución paralela
  de tareas entre paquetes. Valioso cuando hay muchos paquetes y los builds
  empiezan a ser lentos, pero es una capa de más para un monorepo que hoy
  tiene 4 apps y 3 paquetes compartidos. **Se descarta por ahora** (YAGNI);
  queda anotado como candidato natural si el tiempo de build se vuelve un
  problema real (sub-proyecto 6 en adelante).

Cada carpeta en `apps/*` y `shared/*` es un paquete pnpm independiente con su
propio `package.json`, bajo el scope `@nexora/*` (`@nexora/types`,
`@nexora/schemas`, `@nexora/lib`, `@nexora/api`, ...). Este sub-proyecto solo
crea el esqueleto (paquetes vacíos que resuelven correctamente entre sí);
el código real de cada app se construye en su sub-proyecto correspondiente.

### Rol de `apps/api`: API Gateway (ADR-0006)

`apps/api` es el **único componente con ruta pública en Traefik para tráfico
de producto**. Todo cliente —panel admin, sitio web, apps móviles futuras,
integraciones de terceros y la futura API pública— habla exclusivamente con
`apps/api`. Ningún cliente externo toca Postgres, Qdrant, MinIO ni
`apps/agents` directamente; `apps/api` los llama por red interna
(`nexora_net`).

**Por qué:**
- **Aislamiento multi-tenant en un solo lugar.** El `tenant_id` + RLS
  (ADR-0003) solo es tan seguro como el código que lo aplica. Centralizar esa
  resolución evita reimplementar checks de autorización en cada app cliente.
- **Preparado para integraciones sin rediseño.** Cuando aparezca la API
  pública o una integración de terceros, no hay que exponer nada nuevo — el
  gateway ya existe, versionado y con auth pensada para eso.
- **`apps/agents` queda interno**, lo que permite escalarlo distinto del
  resto de la API en el futuro (más CPU/memoria por ejecución de IA) sin que
  el contrato público se entere.

**Dos lineamientos de largo plazo (confirmados con el usuario):**

1. **Orquestación y reglas de negocio, no todo el sistema.** `apps/api` se
   organiza como *modular monolith* por dominio —
   `apps/api/src/modules/{auth, tenants, bookings, agents-proxy, webhooks, billing}`—
   cada uno con sus rutas/servicios/repositorio propios, comunicándose entre
   sí solo a través de interfaces explícitas y de los contratos compartidos
   en `@nexora/types` / `@nexora/schemas`. Los límites entre módulos son los
   mismos por los que se cortaría si un dominio necesita convertirse en
   servicio independiente el día de mañana — el contrato público
   (`/v1/...`) no se entera de ese corte.
2. **Versionado y documentación automática previstos desde el inicio.**
   Todas las rutas se prefijan por versión (`/v1/...`) desde el primer
   endpoint que se escriba, para que convivir con un futuro `/v2/...` sea
   agregar, no migrar. La generación de documentación se hace vía
   **OpenAPI/Swagger** (o equivalente) derivada de los mismos schemas de
   `@nexora/schemas` (p.ej. Zod + `zod-to-openapi`), para que el contrato y
   la doc nunca diverjan. No se implementa en este sub-proyecto — se define
   la convención ahora para no tener que reordenar rutas más adelante.

**Matiz:** n8n conserva su propia ruta en Traefik (editor + webhooks) porque
no es superficie de API del producto — es una herramienta operativa con
webhooks generados dinámicamente. Esto no viola el principio de punto único
de entrada para el producto.

**Alternativas descartadas:**
- *Cada app habla directo con los servicios de datos* — multiplica puntos de
  entrada y duplica lógica de tenant/autorización.
- *Separar gateway y lógica de negocio en dos servicios ya* — agrega
  complejidad operativa sin necesidad real todavía; los módulos internos ya
  dejan esa puerta abierta.

## Arquitectura de la infra base

### Organización de Docker Compose

Se descartó un único `docker-compose.yml` monolítico porque con 8+ servicios
se vuelve difícil de mantener y no permite actualizar un servicio sin tocar el
resto. En su lugar: **Compose modular** — cada servicio vive en su propia
carpeta con su propio `compose.yaml`, combinados desde un orquestador raíz
mediante `include:` (Compose v2.20+). Ver
[ADR-0001](../architecture/decisions/0001-modular-compose.md).

### Reverse proxy: Traefik

Se eligió Traefik sobre Nginx por auto-discovery vía labels de Docker y TLS
automático (Let's Encrypt) — agregar un servicio nuevo no requiere tocar
config central de proxy. Ver
[ADR-0002](../architecture/decisions/0002-traefik-como-reverse-proxy.md).

Entrypoints: `web` (80, redirige a 443) y `websecure` (443, TLS). Dashboard
protegido con auth básica en subdominio propio. En local, hosts resueltos como
`*.nexora.localhost`.

### Red y volúmenes

- Red Docker externa única `nexora_net` (`infra/network/compose.yaml`).
- Servicios internos (Postgres, Redis, Qdrant) no publican puertos al host.
- Volúmenes con nombre, prefijo `nexora_`, sin bind mounts — permite que un
  script de backup los recorra genéricamente.

### Secrets y configuración

- `env/*.env.example` — plantillas versionadas, sin valores reales.
- `secrets/*.env` — valores reales, uno por servicio, gitignored.
- Convención pensada para trasladarse tal cual al VPS (permisos `600`, fuera
  de control de versión). Gestión avanzada de secretos: sub-proyecto 8.

### Observabilidad (reservado)

Carpeta `monitoring/` creada vacía (con `README.md` explicando la intención)
para alojar, en el sub-proyecto 8, compose files de Prometheus (métricas),
Grafana (dashboards) y Loki (logs centralizados) — consistente con que ya
usamos el patrón de compose modular por servicio.

### Testing

- Tests unitarios: colocados junto a cada paquete/app (`apps/api/src/**/*.test.ts`),
  no en `tests/` — es el estándar y evita que `tests/` crezca sin límite.
- `tests/` (raíz) es para pruebas **cross-cutting** que no pertenecen a una
  sola app:
  - `tests/integration/` — interacción entre servicios (p.ej. n8n → Postgres).
  - `tests/e2e/` — Playwright contra el stack completo levantado.
  - `tests/load/` — pruebas de carga. Se propone **k6** (scriptable en
    JS/TS, coherente con el resto del stack, liviano) como herramienta,
    a confirmar cuando este sub-proyecto se aborde en profundidad
    (sub-proyecto 7).
- Este sub-proyecto crea la carpeta y su README explicando la convención; el
  contenido real de cada tipo de test se agrega en el sub-proyecto dueño de lo
  que se está probando.

### CI/CD (`.github/workflows/`)

Alcance de este sub-proyecto: un workflow mínimo de **CI** que corre en cada
push/PR:
- Valida que todos los `compose.yaml` son sintácticamente correctos
  (`docker compose config`).
- Lint del monorepo (`pnpm lint` a nivel raíz, delega a cada paquete).

**CD (deploy automático al VPS) queda fuera de alcance** de este sub-proyecto:
requiere decisiones de acceso/secrets al VPS que se toman en el sub-proyecto 8
(Seguridad y operaciones), cuando ya haya algo real para deployar.

### Registro de decisiones de arquitectura (ADR)

Carpeta `docs/architecture/decisions/`, formato basado en MADR (el estándar
más adoptado para ADRs livianos), un archivo por decisión,
numerado y versionado en git junto con el código:

```
docs/architecture/decisions/
├── 0000-template.md
├── 0001-modular-compose.md
├── 0002-traefik-como-reverse-proxy.md
├── 0003-multi-tenant-schema-compartido-rls.md
├── 0004-pnpm-workspaces-monorepo.md
├── 0005-alcance-multivertical.md
└── 0006-api-gateway.md
```

Plantilla (`0000-template.md`):

```markdown
# NNNN. Título de la decisión

**Fecha:** YYYY-MM-DD
**Estado:** Propuesta | Aceptada | Reemplazada por ADR-XXXX | Rechazada

## Contexto
¿Qué problema u obligación técnica nos hace falta resolver?

## Decisión
¿Qué se decidió, en una o dos frases?

## Alternativas consideradas
Opciones evaluadas y por qué no se eligieron.

## Consecuencias
Qué mejora, qué se vuelve más difícil, qué queda pendiente a futuro.
```

Este sub-proyecto crea la plantilla y los 6 ADR correspondientes a decisiones
ya tomadas en este mismo diseño (Compose modular, Traefik, multi-tenant RLS,
monorepo pnpm, alcance multivertical, `apps/api` como API Gateway). A partir
de acá, cada sub-proyecto
agrega sus propios ADR cuando tome una decisión de arquitectura relevante —
no todo cambio necesita uno, solo decisiones que costaría revertir.

### Estructura de carpetas (actualizada)

```
Nexora - Platform/
├── apps/
│   ├── api/            ← paquete @nexora/api — API Gateway (ADR-0006), esqueleto ahora, sub-proyecto 6
│   ├── admin/           ← paquete @nexora/admin (esqueleto, sub-proyecto 6)
│   ├── web/              ← paquete @nexora/web (esqueleto, sub-proyecto 6)
│   └── agents/           ← paquete @nexora/agents (esqueleto, sub-proyecto 5)
├── ai/
│   ├── prompts/          ← plantillas de prompts versionadas
│   ├── knowledge/        ← documentos fuente para RAG (previos a embeddings)
│   ├── memory/            ← diseño/config de estrategias de memoria conversacional
│   ├── embeddings/        ← scripts/config del pipeline de embeddings
│   └── workflows/         ← definiciones de workflows de n8n exportadas (JSON), versionadas
├── shared/
│   ├── types/             ← paquete @nexora/types
│   ├── schemas/            ← paquete @nexora/schemas
│   └── libraries/           ← paquete @nexora/lib
├── infra/
│   ├── compose.yaml        ← orquestador raíz (usa include:)
│   ├── traefik/
│   │   ├── compose.yaml
│   │   ├── traefik.yml
│   │   └── dynamic/
│   ├── network/
│   │   └── compose.yaml
│   └── services/
│       ├── n8n/compose.yaml
│       ├── postgres/compose.yaml
│       ├── redis/compose.yaml
│       ├── qdrant/compose.yaml
│       ├── minio/compose.yaml
│       └── evolution-api/compose.yaml
├── monitoring/            ← vacío por ahora (Prometheus/Grafana/Loki, sub-proyecto 8)
├── tests/
│   ├── integration/
│   ├── e2e/
│   └── load/
├── secrets/                ← *.env reales, gitignored
├── env/
│   └── *.env.example
├── scripts/
│   ├── up.sh / down.sh
│   ├── update-service.sh
│   └── backup.sh / restore.sh
├── docs/
│   ├── 00-overview.md
│   ├── architecture/
│   │   └── decisions/     ← ADRs (0000-template.md, 0001..0006)
│   ├── services/
│   └── runbooks/
├── .github/
│   └── workflows/
│       └── ci.yml          ← valida compose + lint del monorepo
├── backups/                ← gitignored, con .gitkeep
├── logs/
├── package.json             ← raíz del monorepo (pnpm workspaces)
├── pnpm-workspace.yaml
├── .gitignore
├── README.md
└── CLAUDE.md
```

Este sub-proyecto crea el esqueleto completo de carpetas y llena de contenido
real: `infra/network/`, `infra/traefik/`, `scripts/`, `pnpm-workspace.yaml` +
paquetes vacíos en `apps/*` y `shared/*`, `.github/workflows/ci.yml`, y los
ADR 0001-0006. El contenido de negocio de cada carpeta (`infra/services/*`,
`ai/*`, código real de `apps/*`, `monitoring/*`, tests reales) se completa en
sus sub-proyectos correspondientes.

### Scripts de flujo de trabajo

- `up.sh [servicio]` — sin argumento levanta `network` + `traefik` + todos los
  servicios definidos hasta el momento; con argumento levanta solo ese servicio.
- `down.sh [servicio]` — análogo, baja todo o un servicio puntual.
- `update-service.sh <servicio>` — `pull` + recreate de un solo servicio, sin
  afectar al resto.
- `backup.sh` / `restore.sh` — recorren volúmenes con prefijo `nexora_` y hacen
  `docker run --rm -v <vol>:/data -v .../backups:/backup alpine tar czf ...`.
  Funcionales desde el día uno; se profundizan (retención, cifrado, backups
  remotos) en el sub-proyecto 8.

### Entorno de desarrollo (WSL2)

Se instala `Ubuntu-22.04` vía `wsl --install -d Ubuntu-22.04`, se deja como
distro por defecto, y se configura ahí: Git, Node vía nvm, pnpm, y se confirma
que Docker Desktop tiene habilitada su integración con esa distro (Settings →
Resources → WSL Integration). Todo el trabajo de este proyecto se hace parado
en esa shell — mismo SO que el VPS de producción actual.

## Criterio de éxito / cómo se valida este sub-proyecto

1. `./scripts/up.sh` levanta `network` + `traefik` sin errores.
2. Un contenedor "canario" (`traefik/whoami`) queda accesible en
   `https://whoami.nexora.localhost` con certificado válido.
3. `./scripts/update-service.sh whoami` lo actualiza sin bajar Traefik ni la
   red compartida.
4. `pnpm install` en la raíz resuelve correctamente los paquetes de `apps/*` y
   `shared/*` (esqueleto), sin errores de dependencias.
5. El workflow `.github/workflows/ci.yml` corre en verde en un PR de prueba
   (valida compose + lint).
6. Existen los 7 archivos de `docs/architecture/decisions/` (plantilla + 6 ADR).
7. Estructura de carpetas completa, `.gitignore`, `README.md` y docs base
   commiteados en el repo nuevo (`nexora-platform`, org `EmpresaNexusIA`).

Este sub-proyecto **no** incluye Postgres, n8n, Qdrant, MinIO, Evolution API,
ni código real de `apps/*` o `ai/*` — eso es el contenido de los sub-proyectos
2 en adelante, que se apoyan sobre esta base ya validada.

## Fuera de alcance (explícitamente, para este sub-proyecto)

- Configuración real de cualquier servicio de negocio (n8n, Postgres, etc.).
- Código real de `apps/api`, `apps/admin`, `apps/web`, `apps/agents` — solo
  esqueleto de paquete.
- Contenido real de `ai/*` (prompts reales, pipeline de embeddings, etc.).
- Estrategia de backups remotos / retención / cifrado (sub-proyecto 8).
- Gestión de secretos en producción más allá de archivos `.env` (sub-proyecto 8).
- Monitoreo real (Prometheus/Grafana/Loki) — solo la carpeta reservada.
- Tests reales de integración/e2e/carga — solo la carpeta y convención.
- CD (deploy automático al VPS).
- Deploy al VPS en sí (se hace cuando la base esté validada localmente).
