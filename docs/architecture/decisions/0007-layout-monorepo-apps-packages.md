# 0007. Layout del monorepo: `apps/` para procesos, `packages/` para piezas compartidas

**Fecha:** 2026-08-08
**Estado:** Aceptada

## Contexto

El repo nació (ADR-0004) como monorepo pnpm workspaces. La estructura real
quedó así: `apps/` con cinco aplicaciones (`admin`, `agents`, `api`,
`orchestrator`, `web` — hoy solo `orchestrator` tiene código real, el resto
son skeletons) y `packages/` con las piezas compartidas (`database`: schema
Drizzle + migraciones; `context`: contexto de correlación). La documentación
de la era Windows (CLAUDE.md) hablaba de `shared/*` y ya no refleja la
realidad. Sin una regla escrita, el código compartido podría duplicarse entre
apps o colarse definición de tablas (DDL) por caminos laterales.

## Decisión

Se formaliza el layout actual como definitivo:

- `apps/*` = procesos desplegables (cada empleado digital o servicio es una
  app). Las apps **no se importan entre sí**: si dos apps necesitan lo mismo,
  eso baja a `packages/`.
- `packages/*` = piezas compartidas importables por las apps, cada una con su
  propio `package.json` bajo el scope `@nexora/*`.
- `packages/database` es la **única fuente de verdad del esquema**: toda
  tabla, schema o migración nace ahí (Drizzle). Ninguna app crea DDL por su
  cuenta.

## Alternativas consideradas

- **`shared/*` (nombre original del diseño)** — misma idea, pero `packages/`
  es la convención estándar de pnpm workspaces y ya es la realidad del repo;
  renombrar no aporta nada. Se corrige la documentación en su lugar.
- **Código compartido copiado dentro de cada app** — cada copia diverge a su
  ritmo y un fix en una no llega a las otras. Descartado.
- **Publicar los paquetes a un registry npm** — complejidad innecesaria hoy:
  pnpm workspaces resuelve las dependencias internas sin publicar nada.

## Consecuencias

- Crear un empleado nuevo = crear `apps/<nombre>` que depende de los packages
  que necesite; el patrón ya quedó demostrado por `orchestrator` (Empleado
  #0).
- Toda migración pasa por `packages/database` — el pulso sagrado
  (`drizzle.__drizzle_migrations`) sigue siendo el testigo de qué migraciones
  corrieron.
- Pendiente registrado: actualizar CLAUDE.md (menciona `shared/*` y el
  entorno WSL de la era Windows) para que refleje este layout y el entorno
  Linux Mint actual.
