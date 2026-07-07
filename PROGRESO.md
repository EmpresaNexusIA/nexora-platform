# PROGRESO — Nexora Platform, infra base (sub-proyecto 1/9)

Ejecutado con subagent-driven-development: un subagente implementador por tarea +
un subagente revisor (spec + calidad) por tarea. Repo: `/home/nexora/nexora-platform`
(WSL nativo), rama `master`. Plan: `docs/superpowers/plans/2026-07-07-infra-base-implementation.md`.

A partir de acá trabajo de forma autónoma (autorizado por el usuario el 2026-07-07):
sin pedir confirmaciones, documentando cada decisión y bloqueo acá, resolviendo con
la alternativa más razonable y siguiendo adelante.

## Task 1: Entorno WSL (Node, pnpm, git)
**Estado:** completa. Sin commits (setup de tooling). node v24.18.0, pnpm 11.10.0, identidad git configurada. Revisión: no aplica (no genera diff).

## Task 2: Estructura base del repo
**Estado:** completa y revisada limpia. Commits `5066a51..021b35f`.

## Task 3: Monorepo pnpm — workspace + paquetes `@nexora/*`
**Estado:** completa y revisada limpia. Commits `021b35f..3550f21`.

**Incidente — corte de luz + migración de filesystem:** durante esta tarea se
detectó que `pnpm install` falla de forma reproducible (`EPERM: operation not
permitted, futime`) contra rutas Windows-montadas (`/mnt/c/...`), un problema
conocido de WSL2/DrvFs. Se migró el repo completo a filesystem nativo de WSL
(`/home/nexora/nexora-platform`), preservando el historial de git (commit de
seguimiento `af0df9d` documenta la migración en el CLAUDE.md del repo). La
carpeta vieja `C:\Users\PC\Proyectos-Nexora\Nexora - Platform` quedó **obsoleta**
y no se toca más.

En medio de esto se cortó la luz. Al reanudar la sesión se encontraron restos de
un `npm install lodash` corrido por error contra la carpeta obsoleta de Windows
(`package.json` sobreescrito con un proyecto de prueba "t", `package-lock.json`
suelto, 10 archivos `_tmp_*` vacíos). Diagnóstico confirmado con logs de npm
(`~/.npm/_logs/*.log`, cwd apuntaba a la ruta vieja). No afecta el repo real
(que ya vivía en `/home/nexora/nexora-platform` en ese momento). Se dejó esa
carpeta obsoleta como está — no es parte del repo de git activo.

También se encontró que `docs/superpowers/plans/.../task-4-brief.md` había
quedado vacío (0 bytes): el corte de luz interrumpió al controlador justo
cuando generaba el brief de la Task 4, antes de despachar el implementador.
Task 4 nunca había arrancado — se regeneró el brief y se retomó desde ahí.

## Task 4: Convención secrets/env
**Estado:** completa y revisada limpia (Approved, sin issues Critical/Important).
Commit `1b0358a`.

## Task 5: Red Docker (`nexora_net`) y orquestador raíz
**Estado:** completa. Commit `b67644f`.

**Decisión del controlador (sin bloquear):** Docker Desktop estaba caído (no
arrancó solo tras el reinicio de Windows) — se inició manualmente. Con Docker
arriba, `docker compose -f infra/compose.yaml up -d` falla con `no service
selected`: Docker Compose v5.3.0 no crea una red top-level en aislamiento
cuando el config resuelto no tiene servicios. `docker compose config -q`
(validación de sintaxis) sí pasa. El revisor marcó esto Important pero
confirmó que **no es un defecto del código** — es una limitación de la
versión de Compose, y la red se crea sola en la Task 6 cuando Traefik la
referencia y se levanta. Se aceptó la tarea como completa sin despachar un
fix (no hay nada que arreglar en el código); la verificación de Step 4 quedó
diferida a la Task 6.

## Task 6: Traefik + TLS local (mkcert) + dashboard protegido
**Estado:** en curso.

Steps 1-2 (instalar mkcert + generar cert `*.nexora.localhost`) son
[MANUAL - Windows] por diseño del plan — requieren confirmar un diálogo de
Windows para instalar la CA raíz. Los corrió el usuario a mano antes de
ausentarse; certificados confirmados en
`infra/traefik/certs/{nexora.localhost.pem,nexora.localhost-key.pem}`.
Subagente implementador despachado para Steps 3-12 (confiar la CA desde WSL,
config estática/dinámica de Traefik, hash de la contraseña del dashboard,
`infra/traefik/compose.yaml`, levantar y validar TLS + basic auth, commit).

---
*(este archivo se sigue actualizando después de cada tarea)*
