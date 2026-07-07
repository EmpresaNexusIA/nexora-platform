# Diseño: Infraestructura base — Nexora Platform (sub-proyecto 1/8)

**Fecha:** 2026-07-07
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

Nexora-IA hoy corre como un bot (Telegram/WhatsApp) + panel en un VPS de Hostinger,
usando Supabase como base de datos hosteada. Este documento diseña la base de una
**nueva plataforma self-hosted** (`Nexora Platform`) pensada para eventualmente
reemplazar ese stack: Postgres propio, automatización con n8n, búsqueda semántica,
mensajería, scraping y todo lo necesario para operar Nexora-IA como SaaS
multi-tenant para negocios de servicios (peluquerías, barberías, spas, estética).

No se toca el bot actual en producción durante este trabajo.

## Por qué esto se dividió en sub-proyectos

El pedido original cubre infraestructura base, capa de datos, automatización,
mensajería, IA/RAG, scraping/testing, seguridad y documentación — ocho subsistemas
en gran medida independientes. Diseñarlos y planearlos todos juntos produce un
spec ingobernable. Se decidió trabajar cada uno como su propio ciclo
diseño → spec → plan → implementación, empezando por la infraestructura base
porque todos los demás dependen de ella.

**Orden de sub-proyectos:**
1. **Infra base** (este documento) — Docker Compose, red, Traefik, secrets, scripts.
2. Capa de datos — PostgreSQL multi-tenant, Redis, Qdrant, MinIO.
3. Motor de automatización — n8n.
4. Mensajería — Evolution API (WhatsApp), integración Telegram.
5. Capa de IA — memoria conversacional, embeddings, búsqueda semántica.
6. Scraping/testing — Playwright, Firecrawl.
7. Seguridad y operaciones — backups, monitoreo, logs, rotación de secretos.
8. Documentación — se escribe por capa, no como proyecto aparte.

## Decisiones de contexto (confirmadas con el usuario)

- **Relación con el stack actual:** esta plataforma es el diseño de la próxima
  versión de Nexora-IA, para reemplazar eventualmente Supabase. Arranca en
  desarrollo local (Windows + WSL2) y está pensada para escalar a un VPS propio
  sin rediseño.
- **Multi-tenancy:** schema compartido en Postgres, todas las tablas con columna
  `tenant_id`, aislamiento vía Row-Level Security. Es el patrón estándar de SaaS
  B2B: migraciones únicas, escala bien a cientos de tenants, sin la complejidad
  operativa de un schema o una base por cliente.
- **Entorno de desarrollo:** se instala WSL2 con Ubuntu 22.04 como shell principal
  de trabajo — mismo SO que el VPS de producción actual, evita discrepancias
  Windows/Linux. Docker Desktop ya corre en Windows; se habilita su integración
  con esta distro.
- **Repositorio:** proyecto nuevo en `C:\Users\PC\Proyectos-Nexora\Nexora - Platform\`,
  con repo propio en GitHub (org `EmpresaNexusIA`, nombre sugerido `nexora-platform`),
  separado de `Nexora - Bot` porque es una plataforma nueva, no una modificación
  del bot existente.

## Arquitectura de la infra base

### Organización de Docker Compose

Se descartó un único `docker-compose.yml` monolítico (approach evaluado y
rechazado) porque con 8+ servicios se vuelve difícil de mantener y no permite
actualizar un servicio sin tocar el resto — requisito explícito del usuario.

En su lugar: **Compose modular**. Cada servicio vive en su propia carpeta con su
propio `compose.yaml`, combinados desde un orquestador raíz mediante la
directiva `include:` de Compose (soportada desde v2.20).

### Reverse proxy: Traefik (en vez de Nginx)

El pedido original mencionaba Nginx, pero se evaluaron 3 opciones y se eligió
**Traefik** porque resuelve directamente el requisito de "cada componente se
actualiza sin afectar a los demás":

- Auto-discovery de servicios vía labels de Docker — agregar un servicio nuevo
  no requiere editar config central de proxy.
- Certificados TLS automáticos (Let's Encrypt).
- Dashboard propio, protegido con auth básica y expuesto en subdominio propio.

Entrypoints: `web` (80, redirige a 443) y `websecure` (443, TLS).
En local, los hosts se resuelven como `*.nexora.localhost` (sin tocar `hosts`,
los navegadores modernos resuelven `.localhost` a 127.0.0.1 automáticamente).

### Red y volúmenes

- Una única red Docker externa `nexora_net`, creada por
  `infra/network/compose.yaml`, a la que se conectan todos los servicios.
  Evita el problema de Compose de crear una red por stack que no se puede
  alcanzar entre sí.
- Servicios sin necesidad de exposición externa (Postgres, Redis, Qdrant) no
  publican puertos al host — solo alcanzables dentro de `nexora_net`.
- Volúmenes con nombre, prefijo `nexora_` (`nexora_postgres_data`,
  `nexora_qdrant_data`, etc.), sin bind mounts. El prefijo común es lo que
  permite que un script de backup recorra todos los volúmenes de la plataforma
  genéricamente.

### Secrets y configuración

- `env/*.env.example` — plantillas versionadas en git, sin valores reales.
- `secrets/*.env` — valores reales, uno por servicio (`secrets/postgres.env`,
  `secrets/n8n.env`, ...), gitignored. Cada compose de servicio referencia solo
  el suyo (`env_file: ../../../secrets/<servicio>.env`), no hay un `.env`
  gigante compartido.
- Convención pensada para trasladarse tal cual al VPS más adelante (mismos
  archivos, permisos `600`, fuera de control de versión). La gestión de
  secretos en producción (vault, rotación) se profundiza en el sub-proyecto 7
  (Seguridad y operaciones); acá solo se deja la convención lista.

### Estructura de carpetas

```
Nexora - Platform/
├── infra/
│   ├── compose.yaml              ← orquestador raíz (usa include:)
│   ├── traefik/
│   │   ├── compose.yaml
│   │   ├── traefik.yml           ← config estática (entrypoints, providers)
│   │   └── dynamic/              ← middlewares (auth, rate-limit) por servicio
│   ├── network/
│   │   └── compose.yaml          ← red compartida (se crea una sola vez)
│   └── services/
│       ├── n8n/compose.yaml
│       ├── postgres/compose.yaml
│       ├── redis/compose.yaml
│       ├── qdrant/compose.yaml
│       ├── minio/compose.yaml
│       └── evolution-api/compose.yaml   ← se agrega en su sub-proyecto
├── secrets/                      ← *.env reales, gitignored
├── env/
│   └── *.env.example
├── scripts/
│   ├── up.sh / down.sh
│   ├── update-service.sh
│   └── backup.sh / restore.sh    ← esqueleto funcional, se profundiza en sub-proyecto 7
├── docs/
│   ├── 00-overview.md
│   ├── services/                 ← un doc por servicio
│   └── runbooks/
├── backups/                      ← gitignored, con .gitkeep
├── logs/
├── .gitignore
├── README.md
└── CLAUDE.md
```

Este sub-proyecto crea el esqueleto completo de carpetas, pero solo llena de
contenido real `infra/network/`, `infra/traefik/` y los scripts — los
`compose.yaml` de `infra/services/*` (n8n, postgres, etc.) se completan en sus
propios sub-proyectos.

### Scripts de flujo de trabajo

- `up.sh [servicio]` — sin argumento levanta `network` + `traefik` + todos los
  servicios definidos hasta el momento; con argumento levanta solo ese servicio.
- `down.sh [servicio]` — análogo, baja todo o un servicio puntual.
- `update-service.sh <servicio>` — `pull` + recreate de un solo servicio, sin
  afectar al resto.
- `backup.sh` / `restore.sh` — recorren volúmenes con prefijo `nexora_` y hacen
  `docker run --rm -v <vol>:/data -v .../backups:/backup alpine tar czf ...`.
  Funcionales desde el día uno para los volúmenes que existan; se profundizan
  (retención, cifrado, backups remotos) en el sub-proyecto 7.

### Entorno de desarrollo (WSL2)

Se instala `Ubuntu-22.04` vía `wsl --install -d Ubuntu-22.04`, se deja como
distro por defecto, y se configura ahí: Git, Node vía nvm, y se confirma que
Docker Desktop tiene habilitada su integración con esa distro (Settings →
Resources → WSL Integration). Todo el trabajo de este proyecto se hace parado
en esa shell — mismo SO que el VPS de producción actual (Ubuntu 22.04).

## Criterio de éxito / cómo se valida este sub-proyecto

1. `./scripts/up.sh` levanta `network` + `traefik` sin errores.
2. Un contenedor "canario" (`traefik/whoami`, imagen estándar de prueba) queda
   accesible en `https://whoami.nexora.localhost` con certificado válido —
   prueba que el auto-discovery y TLS funcionan de punta a punta.
3. `./scripts/update-service.sh whoami` lo actualiza sin bajar Traefik ni la
   red compartida.
4. Estructura de carpetas, `.gitignore`, `README.md` y docs base commiteados
   en el repo nuevo (`nexora-platform`, org `EmpresaNexusIA`).

Este sub-proyecto **no** incluye Postgres, n8n, Qdrant, MinIO ni Evolution API
reales — esos son el contenido de los sub-proyectos 2 en adelante, que se
apoyan sobre esta base ya validada.

## Fuera de alcance (explícitamente, para este sub-proyecto)

- Configuración real de cualquier servicio de negocio (n8n, Postgres, etc.).
- Estrategia de backups remotos / retención / cifrado (sub-proyecto 7).
- Gestión de secretos en producción más allá de archivos `.env` (sub-proyecto 7).
- Monitoreo y logging centralizado (sub-proyecto 7).
- Deploy al VPS (se hace cuando la base esté validada localmente).
