# 0008. Roles y grants de PostgreSQL: mínimo privilegio y permisos dentro de la migración

**Fecha:** 2026-08-08
**Estado:** Aceptada — v1.1 (mismo día): `FORCE ROW LEVEL SECURITY` queda como decisión explícita tras revisión cruzada del co-piloto

## Contexto

La migración a Linux (agosto 2026) dejó una lección clave: `pg_dump` **no**
exporta los roles del clúster — hubo que restaurarlos desde un archivo aparte
(`nexora-roles-*.sql`) y re-aplicar una policy faltante de forma quirúrgica.
Hoy el clúster tiene estos roles: `postgres` (superusuario), `nexora_admin`
(dueño dev de los objetos, usado por las herramientas locales), `api_user`
(LOGIN, NOSUPERUSER, NOBYPASSRLS) y `nexora_maintenance_role` (NOLOGIN).

Hay además un matiz de Postgres que define esta decisión: **el dueño de una
tabla bypasea RLS automáticamente**, salvo que la tabla tenga `FORCE ROW
LEVEL SECURITY`; y los superusuarios bypasean siempre, con o sin FORCE. Hoy
TODAS las conexiones (desarrollo y orchestrator, vía `DATABASE_URL`) entran
como `nexora_admin` — o sea que las 6 policies del pulso son por ahora
declarativas en el día a día: el aislamiento de ADR-0003 empieza a morder
recién cuando el runtime use `api_user` **y** las tablas tengan FORCE. Sin
una regla escrita, cualquier app futura podría terminar conectándose como
superusuario "porque funciona", y cualquier conexión del dueño (por error o
costumbre) vería todos los tenants sin que nadie se entere.

## Decisión

- Ninguna aplicación se conecta **jamás** como `postgres`: el superusuario es
  solo para mantenimiento humano (y es el único bypass de RLS que queda —
  ni `FORCE` lo detiene; se usa a propósito y con persona presente).
- `api_user` es el rol de runtime de los servicios (mínimo privilegio, sin
  SUPERUSER y sin BYPASSRLS — condición necesaria para que el aislamiento de
  ADR-0003 se aplique de verdad). Mientras no entre en servicio la capa de
  datos del sub-proyecto 2, el desarrollo local sigue con `nexora_admin`.
- `nexora_maintenance_role` (NOLOGIN) queda como rol contenedor de permisos
  de mantenimiento: nadie se conecta con él; se hereda vía membresía cuando
  haga falta.
- Los permisos de una tabla o schema nuevo **nacen en la misma migración**
  que lo crea (GRANTs dentro del archivo de migración de
  `packages/database`), nunca como `GRANT` manual "al vuelo" que ningún
  respaldo de schema recuerda.
- Toda tabla de negocio (con `tenant_id`) nace con `ENABLE` **y** `FORCE ROW
  LEVEL SECURITY` en su migración: el aislamiento aplica **incluso al dueño
  `nexora_admin`**. "Tener policies" no alcanza — sin FORCE, el dueño pasa
  por arriba del control y el hueco no se nota hasta que es tarde.
- Los roles se exportan a archivo como parte del ritual de respaldo, igual
  que el dump de datos: dump + roles, siempre juntos.

## Alternativas consideradas

- **Un solo rol para todo (`nexora_admin`)** — simple, pero si una app se
  compromete, el atacante es dueño del schema entero y puede saltarse RLS.
  Descartado.
- **RLS sin `FORCE` (cuidar solo a `api_user`)** — deja abierto el bypass
  del dueño: hoy todas las conexiones son del dueño, así que el aislamiento
  quedaría decorativo justo en el entorno donde más se prueba. Descartado.
- **Un rol por app desde el día uno** — sobrediseño hoy: solo existe un
  servicio real (orchestrator). Se adopta un rol de runtime por capa
  (`api_user`) y se evalúan roles por app cuando haya varias en producción.
- **Grants manuales documentados en un runbook** — la documentación se
  olvida; la migración versionada no. Descartado.

## Consecuencias

- El restore siempre es: dump de datos **+** archivo de roles (lección ya
  vivida; queda formalizada para el futuro playbook del VPS).
- Toda tabla nueva sin GRANTs (y, si es de negocio, sin ENABLE+FORCE RLS) en
  su migración es un bug de la migración, no un paso operativo posterior.
- Con FORCE activo, las sesiones dev de `nexora_admin` también deberán
  setear `app.tenant_id` (como manda ADR-0003) sobre tablas de negocio: el
  desarrollo camina por el mismo sendero que producción. Para mantenimiento
  real se entra como `postgres`, a propósito y a la vista.
- Las tablas ya existentes conservan sus permisos actuales (ownership de
  `nexora_admin`); se normalizan (GRANTs a `api_user` + ENABLE/FORCE RLS)
  cuando entre en servicio la capa de datos del sub-proyecto 2.
- Cuando se reactive RLS (ADR-0003), `api_user` ya tiene la forma correcta
  (NOBYPASSRLS) y las tablas la forma correcta (FORCE): el aislamiento
  muerde de verdad.
