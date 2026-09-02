# ADR-0011: Agent Runtime Specification for Web Builder

**Status:** Accepted (2026-08-24) — Nexora Architecture Team
**Origen:** sesión de copiloto (2026-08-24). Documento recibido como texto (no descargable) y archivado en el workspace.

---

## 0. Resumen ejecutivo

- **3 cerebros:** `agent_executions` (identidad de ejecución), `operational_events` (memoria operacional append-only), `agent_projects` (contexto del proyecto).
- **6 tablas SQL nuevas** con RLS, CHECK constraints y grants mínimos para `api_user`.
- **Message Bus:** 7 tópicos definidos con schemas de comando/respuesta idempotente.
- **Decision Engine:** fórmula matemática de decision score + escalamiento automático por nivel.
- **Métricas:** 9 métricas de calidad del agente (incluye `false_autonomy_rate` y `unnecessary_escalation_rate`).
- **Relación con ADRs:** extiende 0003 (RLS), 0008 (Gateway), 0009 (api_user), 0010 (onboarding).

---

## 1. Contexto

Problemas que resuelve:
- Un script de automatización sin trazabilidad.
- Un generador de sitios que inventa datos para cumplir plazos.
- Una caja negra cuyas decisiones no pueden auditarse ni explicarse.
- Un punto de fallo único que no escala ni se integra con otros agentes.

## 2. Problema — Tres cerebros aislados

| Cerebro | Persistencia | Fuente de Verdad | Acceso |
|---|---|---|---|
| Contexto del Cliente | Permanente | PostgreSQL (client_profiles, client_assets, client_legal) | READ por agentes del tenant. WRITE solo con aprobación. |
| Contexto del Proyecto | Duración del proyecto | PostgreSQL JSONB (agent_projects) o Qdrant | READ/WRITE por agente asignado. |
| Memoria Operacional | 7 años, append-only | PostgreSQL (operational_events, agent_decisions, escalation_logs, rework_cycles) | WRITE por agente. READ por plataforma y auditores. |

## 3. NEXORA DATA INTEGRITY POLICY (global)

- **NO_FABRICATION:** ningún agente puede inventar datos.
- **SOURCE_REQUIRED:** todo dato público debe tener source y source_id.
- **INFERENCE_MUST_BE_MARKED:** las deducciones se clasifican como INFERRED y nunca se publican como afirmaciones factuales sin validación.
- **PUBLIC_CONTENT_REQUIRES_VERIFICATION:** solo KNOWN o PROVIDED pueden aparecer en sitios públicos.
- **LEGAL_CONTENT_REQUIRES_APPROVAL:** textos legales requieren Nivel 3.

Ejemplo de clasificación con provenance:

```json
{
  "dato": "Horario de atención: 9 a 18",
  "clasificacion": "KNOWN",
  "source": "client_profile",
  "source_id": "asset_9843",
  "verified_at": "2026-08-24T12:20:00-03:00",
  "verified_by": "platform",
  "confidence": 1.0,
  "usable_in_public_content": true
}
```

## 4. Máquina de Estados del Proyecto

```
DISCOVERY → PLANNING → BUILDING → REVIEW → [REWORK] → READY_FOR_HANDOFF
                                              ↓
                                       HUMAN_REVIEW
                                              ↓
                                       WAITING_FOR_CLIENT
                                              ↓
                                       [BLOCKED] → [CANCELLED]
```

- Estados: DISCOVERY, PLANNING, BUILDING, REVIEW, REWORK, HUMAN_REVIEW, WAITING_FOR_CLIENT, READY_FOR_HANDOFF, HANDOFF_EXECUTING, DELIVERED, MAINTENANCE, BLOCKED (con block_reason: TECHNICAL, BUSINESS, LEGAL, DEPENDENCY, SECURITY, BILLING, CLIENT, EXTERNAL_SERVICE), CANCELLED.
- **Regla crítica:** REVIEW es READ-ONLY sobre project_context. Cualquier modificación requiere transición a REWORK.

## 5. Componente Decisional — Decision Score

Cada elemento del checklist se modela como objeto decisional con impact × weight por dimensión (conversion, confianza, ux, seo, accesibilidad, performance, comprension, funcionalidad).

Fórmula:
- impact ∈ [-3, +3]
- weighted_score = Σ(impact × weight)
- max_possible_score = Σ(3 × weight)
- normalized_score = abs(weighted_score) / max_possible_score × 10

Escalamiento automático:
- 0.0–2.5 → Nivel 0 (Autónomo)
- 2.6–5.0 → Nivel 1 (Supervisor Automático)
- 5.1–7.5 → Nivel 2 (Operador Humano)
- 7.6–10.0 → Nivel 3 (Admin/Legal)

Criticidad de MISSING: low → continuar (placeholder) · medium → continuar con advertencia + memoria · high → WAITING_FOR_CLIENT o DEFERRED · critical → BLOCKED con escalamiento obligatorio.

## 6. Execution Identity

Cada ejecución tiene identidad única e inmutable: execution_id, project_id, client_id, tenant_id, agent_id, agent_version, prompt_version, toolset_version, policy_version, checklist_version, protocol_version, started_at, finished_at, final_status, rework_cycles, escalations.

## 7. Integración Inter-Agente

- Service Registry: resuelve agent_id → capabilities, version, status, endpoint.
- Message Bus: comandos asíncronos con command_id + idempotency_key.
- Capability Contracts: schemas input/output por capacidad, flags idempotent y async.
- No endpoints hardcodeados: URLs se resuelven vía `${CONFIG_KEY}`.

## 8. Handoff y DELIVERED

DELIVERED solo cuando la plataforma confirma: credentials_delivery_requested, documentation_available, analytics_configured, conversion_events_implemented, ssl_active, backup_initial_completed, dependent_agents_notified+acknowledged, production_url_healthy, lighthouse_measured y cwv_measured. La recepción humana de credenciales es evento posterior, no condición de estado.

## 9. Auditoría Inmutable

La Memoria Operacional es append-only. Las correcciones se emiten como nuevos eventos (`web_project_event_corrected`), nunca se modifican registros existentes.

## 10. Esquema de Base de Datos (6 tablas)

### agent_executions
```sql
CREATE TABLE public.agent_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clientes(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  agent_id varchar NOT NULL,
  agent_version varchar NOT NULL,
  prompt_version varchar,
  toolset_version varchar,
  policy_version varchar NOT NULL DEFAULT '2026.08',
  checklist_version varchar NOT NULL,
  protocol_version varchar NOT NULL DEFAULT '2.1.1',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  final_status varchar NOT NULL DEFAULT 'DISCOVERY',
  rework_cycles integer NOT NULL DEFAULT 0,
  escalations integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_executions_tenant_id ON public.agent_executions(tenant_id);
```

### operational_events (append-only)
```sql
CREATE TABLE public.operational_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.agent_executions(id),
  tenant_id uuid NOT NULL,
  event_type varchar NOT NULL,
  actor varchar NOT NULL,
  severity varchar NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- índices: execution_id, tenant_id, event_type, created_at
```

### agent_decisions
```sql
CREATE TABLE public.agent_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.agent_executions(id),
  tenant_id uuid NOT NULL,
  element_id varchar NOT NULL,
  estado_anterior varchar,
  estado_nuevo varchar NOT NULL,
  decision_score jsonb NOT NULL,
  justificacion text NOT NULL,
  aprobado_por varchar,
  nivel_aprobacion integer,
  timestamp_decision timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### rework_cycles
```sql
CREATE TABLE public.rework_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.agent_executions(id),
  tenant_id uuid NOT NULL,
  ciclo_nro integer NOT NULL,
  origen varchar NOT NULL,
  motivo text NOT NULL,
  responsable varchar NOT NULL,
  cambios_solicitados jsonb NOT NULL DEFAULT '[]',
  cambios_implementados jsonb,
  tiempo_estimado interval,
  tiempo_real interval,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### escalation_logs
```sql
CREATE TABLE public.escalation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.agent_executions(id),
  tenant_id uuid NOT NULL,
  nivel_escalamiento integer NOT NULL CHECK (nivel_escalamiento BETWEEN 1 AND 3),
  tipo_bloqueo varchar,
  motivo text NOT NULL,
  contexto_completo jsonb NOT NULL DEFAULT '{}',
  resuelto_por varchar,
  resuelto_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### agent_projects
```sql
CREATE TABLE public.agent_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL UNIQUE REFERENCES public.agent_executions(id),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  project_state varchar NOT NULL DEFAULT 'DISCOVERY',
  block_reason varchar,
  informe_previo jsonb NOT NULL DEFAULT '{}',
  componentes jsonb NOT NULL DEFAULT '[]',
  checklist_progress jsonb NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### RLS (6 tablas) + grants
```sql
ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;
-- (ídem operational_events, agent_decisions, rework_cycles, escalation_logs, agent_projects)

CREATE POLICY tenant_isolation_agent_executions ON public.agent_executions
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
-- (ídem para las 6, usando su tenant_id)

GRANT SELECT, INSERT ON public.agent_executions TO api_user;
GRANT SELECT, INSERT ON public.operational_events TO api_user;
GRANT SELECT, INSERT ON public.agent_decisions TO api_user;
GRANT SELECT, INSERT ON public.rework_cycles TO api_user;
GRANT SELECT, INSERT ON public.escalation_logs TO api_user;
GRANT SELECT, INSERT, UPDATE ON public.agent_projects TO api_user;
-- api_user NO puede UPDATE ni DELETE en tablas append-only
```

### CHECK en agent_executions
```sql
ALTER TABLE public.agent_executions ADD CONSTRAINT chk_agent_executions_status
  CHECK (final_status IN ('DISCOVERY','PLANNING','BUILDING','REVIEW','REWORK','HUMAN_REVIEW','WAITING_FOR_CLIENT','READY_FOR_HANDOFF','HANDOFF_EXECUTING','DELIVERED','MAINTENANCE','BLOCKED','CANCELLED'));
```

## 11. Contratos de Message Bus (7 tópicos)

| Tópico | Productor | Consumidor | Descripción |
|---|---|---|---|
| agent.integration.required | Cualquier agente | Service Registry + Target Agent | Solicitud de integración |
| agent.integration.completed | Target Agent | Orquestador + Source Agent | Confirmación |
| agent.integration.failed | Target Agent | Orquestador + Source Agent | Fallo con retry policy |
| agent.escalation.required | Cualquier agente | Supervisor + Human Operator | Escalamiento |
| agent.escalation.resolved | Human Operator | Orquestador + Source Agent | Resolución |
| agent.project.state_changed | Agente | Observabilidad + Dashboard | Cambio de estado |
| agent.project.delivered | Agente | CRM + Billing + Analytics | Trigger post-venta |

Schemas: comando con message_id, payload (command_id, idempotency_key, source_agent, target_agent, capability, project_id, tenant_id, params, deadline) · respuesta idempotente con status (incluye `already_executed`).

## 12. Métricas de Calidad del Agente (9)

| Métrica | Objetivo |
|---|---|
| Tiempo de Ciclo (DELIVERED - DISCOVERY) | < 14 días |
| Tiempo en WAITING_FOR_CLIENT | < 30% del ciclo |
| Tasa de Escalamiento | < 15% |
| Tasa de Re-trabajo | < 20% |
| Ciclos de Rework promedio | < 1.5 |
| Cobertura de Checklist | = 100% |
| **False Autonomy Rate** | < 5% |
| **Unnecessary Escalation Rate** | < 10% |
| Approval Override Rate | < 3% |

## 13. Relación con ADRs previos

- ADR-0003: multi-tenant con RLS (todas las tablas nuevas la aplican).
- ADR-0008: Gateway autentica al agente como cualquier cliente (JWT RS256 + tenant context).
- ADR-0009: api_user con SELECT/INSERT append-only; sin UPDATE/DELETE en auditoría.
- ADR-0010: onboarding alimenta el Contexto del Cliente que el agente usa en DISCOVERY.

## 14. Estado de implementación (al 24/8)

| Componente | Estado |
|---|---|
| Tablas SQL + RLS + Grants (migración 0011) | Pendiente |
| Service Registry | Pendiente |
| Message Bus (Redis Streams o NATS) | Pendiente |
| Decision Engine (TS, packages/agent-runtime) | Pendiente |
| State Machine (TS, packages/agent-runtime) | Pendiente |
| Web Builder Agent (apps/agent-web-builder) | Pendiente |
| NEXORA DATA INTEGRITY POLICY (docs/policies/data-integrity.md) | Pendiente |

## 15. Notas

- La v2.1.1 del Protocolo de Integración del Empleado Digital Web es complemento operativo.
- El checklist de construcción web (v1) sigue válido; este ADR no lo modifica.
- La política de integridad de datos es adoptada por todos los futuros agentes (Marketing, Stock, Atención, Ventas).

---

*Archivado en el workspace del chat de taller el 24/8/2026 (fuente: sesión de copiloto, pegado por el fundador).*
