# 0006. `apps/api` como API Gateway y único punto de entrada público

**Fecha:** 2026-07-07
**Estado:** Aceptada

## Contexto

La plataforma va a tener varios clientes (panel admin, sitio web, apps
móviles futuras, integraciones de terceros, una futura API pública) y varios
servicios internos con datos sensibles (Postgres con `tenant_id` + RLS,
Qdrant, MinIO, `apps/agents`). Hay que decidir si cada cliente habla directo
con cada servicio interno que necesita, o si hay un único punto de entrada.

## Decisión

`apps/api` es el **único componente con ruta pública en Traefik para tráfico
de producto**. Todo cliente —panel admin, sitio web, apps móviles futuras,
integraciones de terceros y la futura API pública— habla exclusivamente con
`apps/api`. Ningún cliente externo toca Postgres, Qdrant, MinIO ni
`apps/agents` directamente; `apps/api` los llama por red interna (`nexora_net`).

n8n conserva su propia ruta en Traefik (editor + webhooks) porque no es
superficie de API del producto — es una herramienta operativa con webhooks
generados dinámicamente. Esto no viola el principio de punto único de entrada
para el producto.

Dos lineamientos de largo plazo, confirmados explícitamente para evitar que
`apps/api` se convierta en un monolito no modular con el tiempo:

1. **Orquestación y reglas de negocio, no todo el sistema.** `apps/api` se
   organiza como *modular monolith* por dominio —
   `apps/api/src/modules/{auth, tenants, bookings, agents-proxy, webhooks, billing}` —
   cada uno con sus rutas/servicios/repositorio propios, comunicándose entre
   sí solo a través de interfaces explícitas y de los contratos compartidos
   en `@nexora/types` / `@nexora/schemas`. Los límites entre módulos son los
   mismos por los que se cortaría si un dominio necesita convertirse en
   servicio independiente el día de mañana — el contrato público (`/v1/...`)
   no se entera de ese corte.
2. **Versionado y documentación automática previstos desde el inicio.**
   Todas las rutas se prefijan por versión (`/v1/...`) desde el primer
   endpoint que se escriba, para que convivir con un futuro `/v2/...` sea
   agregar, no migrar. La documentación se genera vía OpenAPI/Swagger (p. ej.
   Zod + `zod-to-openapi`) derivada de los mismos schemas de
   `@nexora/schemas`, para que el contrato y la doc nunca diverjan.

## Alternativas consideradas

- **Cada app habla directo con los servicios de datos** — multiplica puntos
  de entrada y obliga a reimplementar la resolución de `tenant_id` + checks
  de autorización en cada app cliente, en vez de una sola vez.
- **Separar gateway y lógica de negocio en dos servicios ya (microservicio de
  gateway + microservicio de dominio)** — agrega complejidad operativa
  (dos deploys, dos servicios a monitorear) sin necesidad real todavía; el
  corte por módulos dentro de `apps/api` ya deja esa puerta abierta para
  cuando la necesidad sea real.

## Consecuencias

- Aislamiento multi-tenant (ADR-0003) centralizado en un solo lugar en vez de
  reimplementado por cada app cliente.
- Preparado para integraciones de terceros y API pública sin rediseño — el
  gateway ya existe, versionado, con auth pensada para eso.
- `apps/agents` queda interno, lo que permite escalarlo distinto del resto de
  la API en el futuro (más CPU/memoria por ejecución de IA) sin que el
  contrato público se entere.
- Si en el futuro un módulo (p. ej. `billing`) necesita volverse un servicio
  aparte, el corte ya está hecho por diseño — no hay que primero desenredarlo
  de un monolito no modular.
- Este sub-proyecto (infra base) no crea el contenido de `apps/api` — solo el
  esqueleto de paquete (Tarea 3). Los módulos por dominio y las rutas `/v1`
  reales se construyen en el sub-proyecto 6.
