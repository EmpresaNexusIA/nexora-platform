# 0003. Multi-tenancy: schema compartido + Row-Level Security

**Fecha:** 2026-07-07
**Estado:** Aceptada

## Contexto

Nexora Platform es multi-tenant desde el diseño: cada cliente (comercio,
distribuidora, taller, profesional, industria, entidad pública) es un tenant
aislado sobre la misma infraestructura. Hay que decidir cómo se aísla su data
en PostgreSQL antes de diseñar el modelo de datos del sub-proyecto 2.

## Decisión

Un único schema de Postgres compartido entre todos los tenants. Toda tabla de
negocio lleva una columna `tenant_id`, y el aislamiento entre tenants se
aplica con Row-Level Security (RLS) a nivel de fila, no de schema ni de base
de datos.

## Alternativas consideradas

- **Un schema de Postgres por tenant** — aislamiento más fuerte a nivel de
  metadata, pero cada alta de tenant implica migrar N schemas en vez de uno,
  y las queries cross-tenant (reportes internos, soporte) se vuelven
  significativamente más complejas.
- **Una base de datos por tenant** — el aislamiento más fuerte de los tres,
  pero no escala operativamente: cientos de tenants implican cientos de
  bases de datos para monitorear, respaldar y migrar, con el consumo de
  recursos de Postgres que eso implica.
- **Schema compartido sin RLS (filtrado solo a nivel de aplicación)** —
  descartado: un solo bug de autorización en cualquier query de cualquier
  capa (API, agente de IA, script interno) expondría datos de otro tenant.
  RLS mueve esa garantía a la base de datos, no al código de aplicación.

## Consecuencias

- Una sola migración de schema sirve para todos los tenants — altas y
  cambios de modelo son operativamente simples.
- El aislamiento depende de que **todas** las conexiones a Postgres seteen el
  tenant activo (vía `SET app.tenant_id` o equivalente) antes de cualquier
  query — esto es responsabilidad del código de `apps/api` (ver ADR-0006):
  ninguna app cliente ni servicio interno debe hablarle a Postgres
  directamente sin pasar por esa capa.
- El modelo de datos del sub-proyecto 2 se diseña con `tenant_id` en toda
  tabla de negocio desde la primera migración, no como agregado posterior.
