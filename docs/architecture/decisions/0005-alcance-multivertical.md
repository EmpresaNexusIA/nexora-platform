# 0005. Alcance multi-vertical, no solo negocios de servicios

**Fecha:** 2026-07-07
**Estado:** Aceptada

## Contexto

El alcance original de Nexora-IA (el bot actual en producción) era un SaaS
para negocios de servicios: peluquerías, barberías, spas, estética. Al
diseñar Nexora Platform como reemplazo de ese stack, esa restricción quedó en
discusión: ¿la próxima versión sigue limitada a ese vertical o se diseña para
cualquier tipo de cliente desde el principio?

## Decisión

Nexora Platform se diseña para atender cualquier tipo de cliente —comercios,
distribuidoras, talleres, profesionales independientes, industrias,
instituciones y entidades públicas— no solo negocios de servicios. El modelo
de datos (sub-proyecto 2) y los agentes de IA (sub-proyecto 5) se diseñan
pensando en verticales distintas desde el principio.

## Alternativas consideradas

- **Mantener el alcance original (negocios de servicios) y generalizar
  después** — evita sobre-diseñar ahora, pero el modelo de datos y los
  prompts/agentes de IA de un negocio de turnos (peluquería) tienen supuestos
  muy distintos a los de una distribuidora (pedidos, stock, logística) o un
  taller (órdenes de trabajo, repuestos). Generalizar después implicaría
  migrar el modelo de datos ya en producción con tenants reales cargados —
  mucho más costoso que diseñarlo abierto desde ahora, cuando todavía no hay
  ningún tenant real sobre esta plataforma.

## Consecuencias

- El modelo de datos multi-tenant (ADR-0003) no puede asumir conceptos
  específicos de "negocio de servicios" (turnos, profesionales) como
  entidades de primer nivel — esos son un caso particular a modelar dentro de
  un esquema más general (sub-proyecto 2).
- Los agentes de IA (sub-proyecto 5) se diseñan con conocimiento/prompts
  configurables por vertical, no un único prompt genérico de "asistente de
  turnos".
- El bot actual en producción (`Nexora - Bot`, limitado a negocios de
  servicios) no se toca ni se migra en este trabajo — sigue operando tal cual
  hasta que Nexora Platform esté lista para reemplazarlo.
