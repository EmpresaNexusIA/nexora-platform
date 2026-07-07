# 0001. Docker Compose modular en vez de un archivo monolítico

**Fecha:** 2026-07-07
**Estado:** Aceptada

## Contexto

Nexora Platform va a correr 8+ servicios (Traefik, Postgres, Redis, Qdrant,
MinIO, n8n, Evolution API, y los que se sumen). Un único `docker-compose.yml`
en la raíz se vuelve difícil de mantener a ese tamaño y no permite actualizar
un servicio sin tocar la definición del resto.

## Decisión

Cada servicio vive en su propia carpeta bajo `infra/` con su propio
`compose.yaml` (`infra/traefik/compose.yaml`, `infra/services/<servicio>/compose.yaml`,
etc.), combinados desde un orquestador raíz (`infra/compose.yaml`) mediante
`include:` (soportado desde Docker Compose v2.20+).

## Alternativas consideradas

- **Un solo `docker-compose.yml` monolítico** — simple al principio, pero con
  8+ servicios se vuelve un archivo de cientos de líneas donde cualquier
  cambio a un servicio arriesga romper la definición de otro.
- **Un `docker-compose.yml` por servicio sin mecanismo de combinación** —
  obliga a levantar cada stack por separado a mano (`docker compose -f a.yml
  -f b.yml up`), perdiendo la ventaja de un solo comando (`up.sh`) para todo
  el entorno.

## Consecuencias

- Agregar un servicio nuevo es agregar una carpeta + una línea en el
  `include:` del orquestador raíz, sin tocar la definición de los demás.
- `scripts/update-service.sh` puede actualizar un solo servicio sin bajar el
  resto del stack.
- Requiere Docker Compose v2.20+ en cualquier entorno donde se use este repo
  (local, CI, VPS) — ya validado en desarrollo (v5.3.0).
