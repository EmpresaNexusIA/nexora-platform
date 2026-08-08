# 0008. Roles y grants de PostgreSQL: mínimo privilegio y permisos dentro de la migración

**Fecha:** 2026-08-08
**Estado:** Aceptada

## Contexto

La migración a Linux (agosto 2026) dejó una lección clave: `pg_dump` **no**
exporta los roles del clúster — hubo que restaurarlos desde un archivo aparte
(`nexora-roles-*.sql`) y re-aplicar una policy faltante de forma quirúrgica.
Hoy el clúster tiene estos roles: `postgres` (superusuario), `nexora_admin`
(dueño dev de los objetos, usado por las herramientas locales), `api_user`
(LOGIN, NOSUPERUSER, NOBYPASSRLS) y `nexora_maintenance_role` (NOLOGIN). Sin
una regla escrita, cualquier app futura podría terminar conectándose como
superusuario "porque funciona", y el RLS de ADR-0003 perdería efecto: RLS
solo protege a roles sin BYPASSRLS.

## Decisión

- Ninguna aplicación se conecta **jamás** como `postgres`: el superusuario es
  solo para mantenimiento humano.
- `api_user` es el rol de runtime de los servicios (mínimo privilegio, sin
  SUPERUSER y sin BYPASSRLS — condición necesaria para que el aislamiento de
  ADR-0003 se aplique de verdad). Mientras no exista la capa de acceso del
  sub-proyecto 2, el desarrollo local sigue con `nexora_admin`.
- `nexora_maintenance_role` (NOLOGIN) queda como rol contenedor de permisos
  de mantenimiento: nadie se conecta con él; se hereda vía membresía cuando
  haga falta.
- Los permisos de una tabla o schema nuevo **nacen en la misma migración**
  que lo crea (GRANTs dentro del archivo de migración de
  `packages/database`), nunca como `GRANT` manual "al vuelo" que ningún
  respaldo de schema recuerda.
- Los roles se exportan a archivo como parte del ritual de respaldo, igual
  que el dump de datos: dump + roles, siempre juntos.

## Alternativas consideradas

- **Un solo rol para todo (`nexora_admin`)** — simple, pero si una app se
  compromete, el atacante es dueño del schema entero y puede saltarse RLS.
  Descartado.
- **Un rol por app desde el día uno** — sobrediseño hoy: solo existe un
  servicio real (orchestrator). Se adopta un rol de runtime por capa
  (`api_user`) y se evalúan roles por app cuando haya varias en producción.
- **Grants manuales documentados en un runbook** — la documentación se
  olvida; la migración versionada no. Descartado.

## Consecuencias

- El restore siempre es: dump de datos **+** archivo de roles (lección ya
  vivida; queda formalizada para el futuro playbook del VPS).
- Toda tabla nueva sin GRANTs en su migración es un bug de la migración, no
  un paso operativo posterior.
- Las tablas ya existentes conservan sus permisos actuales (ownership de
  `nexora_admin`); se normalizan cuando entre en servicio la capa de acceso
  del sub-proyecto 2.
- Cuando se reactive RLS (ADR-0003), `api_user` ya tiene la forma correcta
  (NOBYPASSRLS) para que el aislamiento se aplique.
