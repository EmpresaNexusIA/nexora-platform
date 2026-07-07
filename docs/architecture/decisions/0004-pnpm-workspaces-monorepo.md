# 0004. Monorepo con pnpm workspaces

**Fecha:** 2026-07-07
**Estado:** Aceptada

## Contexto

`shared/` (`types`, `schemas`, `libraries`) se consume desde varias `apps/*`
(`api`, `admin`, `web`, `agents`). Sin una herramienta de workspaces,
`shared/` termina copy-pasteado o enlazado a mano entre apps — exactamente el
tipo de deuda técnica que este proyecto busca evitar desde el día uno.

## Decisión

Monorepo con **pnpm workspaces**. Cada carpeta en `apps/*` y `shared/*` es un
paquete pnpm independiente con su propio `package.json`, bajo el scope
`@nexora/*`, listados en `pnpm-workspace.yaml`.

## Alternativas consideradas

- **npm workspaces** — viene con Node, cero dependencias nuevas, pero
  resolución de dependencias más lenta y menos estricta (permite "phantom
  dependencies": un paquete puede importar algo que no declaró en su propio
  `package.json` si otro paquete del monorepo lo trae).
- **pnpm workspaces (elegida)** — mismo modelo mental que npm workspaces,
  instalación más rápida, y un `node_modules` estricto por paquete que evita
  phantom dependencies. Estándar de facto para monorepos de este tamaño.
- **Turborepo/Nx sobre pnpm** — agregan cacheo de builds y ejecución paralela
  de tareas entre paquetes. Valioso cuando hay muchos paquetes y los builds
  se vuelven lentos, pero es una capa de más para un monorepo que hoy tiene 4
  apps y 3 paquetes compartidos, todos sin build real todavía. Se descarta
  por ahora (YAGNI); candidato natural si el tiempo de build se vuelve un
  problema real (sub-proyecto 6 en adelante).

## Consecuencias

- `shared/types`, `shared/schemas` y `shared/libraries` se referencian desde
  cualquier `apps/*` con `"@nexora/x": "workspace:*"`, resuelto por symlink,
  sin copiar código.
- Un solo `pnpm install` en la raíz resuelve todo el monorepo.
- Si el tiempo de build/test crece, Turborepo o Nx quedan como upgrade path
  natural sin reestructurar carpetas.
