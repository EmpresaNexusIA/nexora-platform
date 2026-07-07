# REPORTE FINAL — Nexora Platform, infra base (sub-proyecto 1/9)

Fecha: 2026-07-07. Ejecutado en modo autónomo (autorizado por el usuario)
con subagent-driven-development: un subagente implementador + un subagente
revisor (spec + calidad) por tarea, más una revisión final de toda la rama.
Bitácora paso a paso en `PROGRESO.md` (mismo directorio) — este documento es
el resumen ejecutivo.

## Resumen: qué se construyó

El esqueleto completo de infraestructura base de Nexora Platform:

- **Monorepo pnpm** (`apps/*`, `shared/*`), paquetes `@nexora/*` (`types`,
  `schemas`, `lib`, `api`, `admin`, `web`, `agents`) — sin código de negocio
  todavía, solo estructura que resuelve entre sí.
- **Docker Compose modular**: red externa `nexora_net`, orquestador raíz
  (`infra/compose.yaml`) que combina un `compose.yaml` por servicio vía
  `include:`.
- **Traefik v3.7** como único reverse proxy: TLS local confiable (mkcert),
  dashboard protegido con basic auth, entrypoints `web`/`websecure` con
  redirect HTTP→HTTPS.
- **Canario `whoami`** funcionando de punta a punta por `https://whoami.nexora.localhost`.
- **Scripts operativos**: `up.sh`, `down.sh`, `update-service.sh`,
  `backup.sh`, `restore.sh`.
- **Convención de secrets**: plantillas versionadas (`env/*.env.example`) vs.
  valores reales gitignored (`secrets/*.env`).
- **Carpetas reservadas** documentadas para los 8 sub-proyectos futuros
  (`ai/*`, `monitoring/`, `tests/*`, `docs/services`, `docs/runbooks`, `logs/`).
- **7 ADRs** (Architecture Decision Records) formalizando las decisiones ya
  tomadas.
- **CI** (`.github/workflows/ci.yml`): valida sintaxis de todos los compose y
  corre lint del monorepo.

Todo commiteado en `master` (18 commits desde el spec inicial hasta acá),
working tree limpio.

## Decisiones tomadas (y por qué)

1. **Migración del repo de Windows (`C:\...`) a filesystem nativo de WSL
   (`/home/nexora/nexora-platform`)**, durante la Task 3: `pnpm install`
   fallaba de forma reproducible (`EPERM: operation not permitted, futime`)
   contra rutas Windows-montadas — bug conocido de WSL2/DrvFs. Se preservó
   todo el historial de git. La carpeta vieja de Windows quedó obsoleta y no
   se usa más.
2. **`core.fileMode` activado repo-wide** (Task 7): estaba en `false`
   (heredado de la migración), lo que ocultaba silenciosamente los cambios
   de permiso de ejecución de git — causó que dos scripts se commitearan sin
   `chmod +x`. Se corrigió la causa raíz, no solo el síntoma, evitando que se
   repita en tareas futuras.
3. **Docker `credsStore` vaciado** (`~/.docker/config.json`, Task 6, fuera
   del repo): el interop de WSL para binarios `.exe` de Windows está roto en
   esta sesión, lo que bloqueaba el credential helper de Docker Desktop hasta
   para pulls anónimos. Backup en `~/.docker/config.json.bak`. Solo afecta
   pulls autenticados contra registries privados (no se usa ninguno en este
   sub-proyecto — solo imágenes públicas).
4. **Docker Desktop se inició manualmente** (Task 5): no había arrancado
   solo tras el reinicio de Windows por el corte de luz.
5. **`gh` (GitHub CLI) instalado** en la distro WSL (Task 12, vía apt) para
   dejar todo listo para el push — pero no pude autenticarlo (ver pendientes).
6. **Versión mínima de Docker Compose corregida en la documentación**
   (ADR-0001 y el spec decían v2.20+; en realidad hace falta v2.24+ por la
   sintaxis larga de `env_file` que usa `infra/traefik/compose.yaml`) —
   encontrado por la revisión final, corregido en el momento (commit
   `6036d79`).

## Problemas encontrados y cómo se resolvieron

- **Corte de luz a mitad de la Task 3**: dejó un `package.json` corrompido y
  archivos temporales sueltos en la carpeta vieja de Windows (de un
  `npm install lodash` corrido por error contra esa ruta), y el brief de la
  Task 4 vacío (0 bytes, nunca se había arrancado esa tarea). Diagnosticado
  con logs de npm y el ledger de progreso; la carpeta vieja quedó obsoleta
  (no se tocó más) y la Task 4 se retomó desde cero con un brief regenerado.
- **Task 7 — Critical real encontrado en revisión**: `scripts/up.sh` y
  `down.sh` quedaron commiteados sin permiso de ejecución, y el reporte del
  implementador se contradecía a sí mismo al respecto. Se despachó un
  subagente de fix + re-verificación independiente completa (no solo el
  `chmod`), y se corrigió la causa raíz (`core.fileMode`, ver arriba) para
  que no volviera a pasar en la Task 8.
- **Task 5 — limitación de Docker Compose v5.3.0**: `docker compose up -d`
  no crea una red standalone cuando el config resuelto no tiene servicios
  (`no service selected`). No es un bug del código — se confirmó que la red
  se crea sola en la Task 6 cuando Traefik la referencia y se levanta.
- **Fragilidad de comandos multilínea a través de `wsl.exe -> bash -lc`**:
  varias tareas (7, 8) encontraron que scripts combinados complejos a través
  de esa tubería producen output entremezclado o variables que no capturan
  bien. Resuelto en cada caso ejecutando comandos discretos y secuenciales.
  Vale tenerlo presente para sub-proyectos futuros.

## Qué quedó pendiente — necesito esto de vos

**Task 12 (push a GitHub) está bloqueada en la autenticación, no en el
código.** Instalé `gh` (v2.96.0) pero no hay forma de loguearlo sin tu
intervención: no hay token (`GH_TOKEN`/`GITHUB_TOKEN`), no hay SSH key para
`github.com`, no hay sesión previa de `gh auth login`.

**Para destrabarlo, elegí una:**

1. Corré vos mismo, en una terminal (podés usar `!` en el prompt de Claude
   Code):
   ```
   wsl.exe -d Ubuntu-22.04 -- gh auth login
   ```
   y seguí el flujo interactivo (browser + código, o pegar un Personal
   Access Token). Después decime y termino Task 12 yo.

2. O corré vos mismo los 3 pasos que quedan (ya con los comandos exactos en
   `.superpowers/sdd/task-12-brief.md`, Steps 1, 2 y 7):
   ```
   gh repo create EmpresaNexusIA/nexora-platform --private --source=. --remote=origin
   git push -u origin master
   # + el ciclo de PR de prueba del Step 7 para confirmar que CI corre en verde
   ```

El nombre/visibilidad del repo (`EmpresaNexusIA/nexora-platform`, privado) ya
estaba fijado en el plan — no hace falta que lo confirmes de nuevo, solo la
autenticación.

**Una vez que el repo esté en GitHub**, lo primero que hay que hacer (ya
anotado como recomendación de la revisión final) es abrir el PR de prueba del
Step 7 y confirmar que los dos jobs de CI (`validate-compose`, `lint`) corren
en verde en el runner real — hasta ahora solo se validó localmente que esos
mismos comandos funcionan.

## Cosas para tener en cuenta antes del sub-proyecto 2 (no bloquean, pero anotadas)

De la revisión final de toda la rama (18 commits, `d7304a5..af4eff0`,
veredicto: **listo para mergear/pushear, con fixes** — el único fix real ya
se aplicó, el resto son notas para más adelante):

- `restore.sh` no tiene confirmación ni chequea si el volumen destino está en
  uso por un contenedor corriendo — restaurar un volumen de Postgres en vivo
  lo corrompería. Aceptable ahora (no hay volúmenes reales todavía), pero hay
  que endurecerlo antes de que el sub-proyecto 2 (capa de datos) meta datos
  reales encima.
- El job `lint` de CI hoy no lintea nada de verdad (ningún paquete define
  `lint` todavía, así que `--if-present` lo saltea) — va a empezar a tener
  sentido cuando haya código de aplicación real.
- El bloque de "cargar `secrets/*.env`" está triplicado igual en `up.sh`,
  `down.sh` y `update-service.sh` — a esta escala (3 scripts cortos) no
  amerita una abstracción todavía, pero si se agregan más scripts que lo
  necesiten, vale la pena extraerlo a `scripts/_lib.sh`.

## Estado final

- Working tree limpio, 20 commits en `master` (`af0df9d`..`6036d79` sobre el
  historial previo), todas las tareas 1-11 completas y revisadas (Approved),
  Task 12 completa salvo la parte de GitHub.
- Repo real: `/home/nexora/nexora-platform` (WSL nativo) — accesible desde
  Windows en `\\wsl.localhost\Ubuntu-22.04\home\nexora\nexora-platform`.
- `PROGRESO.md` en la raíz del repo tiene el detalle completo tarea por
  tarea, con cada decisión y su porqué.
