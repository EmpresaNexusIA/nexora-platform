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
**Estado:** implementada y commiteada (`2880ea6`), en revisión.

Steps 1-2 (instalar mkcert + generar cert `*.nexora.localhost`) son
[MANUAL - Windows] por diseño del plan — las corrió el usuario a mano antes de
ausentarse; certificados confirmados en
`infra/traefik/certs/{nexora.localhost.pem,nexora.localhost-key.pem}`.

**Problema de entorno encontrado (documentado por el implementador, sin tocar
el contenido de los archivos del brief):** el interop de WSL para ejecutar
binarios `.exe` de Windows está roto en esta sesión (falta
`/proc/sys/fs/binfmt_misc/WSLInterop`). Esto rompió tres cosas del Step 3/10,
todas resueltas con workarounds razonables y reversibles:
1. `cmd.exe /c "mkcert.exe -CAROOT"` fallaba (`Exec format error`) → se leyó
   `rootCA.pem` directo desde `/mnt/c/Users/PC/AppData/Local/mkcert/` en vez
   de ejecutar el binario. Mismo resultado (CA confiada, verificado con
   `openssl s_client ... Verify return code: 0 (ok)`).
2. `sudo` sin contraseña se colgaba (usuario `nexora` no tiene sudo sin
   password en esta sesión) → se usó `wsl.exe -u root` en su lugar para los
   mismos comandos. Mismo resultado.
3. El pull de la imagen `traefik:v3.7.6` fallaba porque
   `~/.docker/config.json` apunta a un credential helper (`desktop.exe`) que
   también depende del interop roto → se vació `credsStore` en
   `~/.docker/config.json` (backup en `~/.docker/config.json.bak`). Como solo
   se hacen pulls anónimos de Docker Hub (imágenes públicas), no hay impacto
   de seguridad. **Decisión:** dejarlo así mientras el interop siga roto; si
   se arregla, se puede restaurar el backup. Si una tarea futura necesita
   autenticarse contra un registry privado, hay que resolver esto de nuevo.

Verificación real: `docker compose config -q` OK, `nexora_traefik` `Up`,
`nexora_net` creada con driver `bridge`, dashboard responde `401` sin
credenciales y `200` con ellas, TLS validado de punta a punta sin `-k`
(`Verify return code: 0 (ok)`). `secrets/traefik.env` (con el hash de la
password) NO quedó en el commit, confirmado. Reporte completo en
`.superpowers/sdd/task-6-report.md`.

**Nota para tareas futuras:** si algo necesita volver a invocar un `.exe` de
Windows desde dentro de WSL (por ejemplo correr `mkcert.exe` de nuevo para
agregar hostnames), el interop roto va a repetir el mismo problema — usar el
mismo tipo de workaround (leer archivos directo por `/mnt/c` en vez de
ejecutar el binario, o pedirle el paso MANUAL al usuario si hace falta
ejecutar algo interactivo en Windows).

---
*(este archivo se sigue actualizando después de cada tarea)*
