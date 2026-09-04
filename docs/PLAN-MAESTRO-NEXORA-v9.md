# 🏛️ REPORTE FINAL DEFINITIVO — NEXORA
**Operaciones y Estrategia · 03/09/2026 · Rosario, Santa Fe, Argentina 🇦**
**Fuentes:** 28 documentos únicos + estado declarado por el fundador el 03/09 (cierre de D1, inicio de D2)
**Autoridad:** este documento es el único plan vigente desde hoy. Al volcarse a `docs/` como PLAN v9 (T0.3), ratifica esta autoridad. Un solo equipo. 🧉

---

# 1. DEFINICIÓN DEL PROYECTO — Qué estamos haciendo y hacia dónde vamos

## 1.1 Qué es Nexora (en 3 líneas)

**Nexora Platform** es una plataforma SaaS **self-hosted y multi-tenant** que vende **empleados digitales** a pymes: agentes de IA que no conversan, sino que **trabajan** — atienden, organizan, responden, procesan — con identidad, permisos, herramientas autorizadas, límites, trazabilidad completa y **autonomía graduada** (A0→A3) bajo supervisión humana.

## 1.2 El problema que resuelve

Una pyme rosarina pierde plata todos los días en trabajo repetitivo: consultas que no llegan a responderse, seguimientos que nadie hace, presencia digital inexistente o amateur, y procesos manuales que el dueño ejecuta a mano. No puede contratar gente para cada tarea, y la oferta actual no sirve: los chatbots básicos no ejecutan trabajo real, las plantillas web no representan al negocio, y las agencias no entregan trazabilidad ni control. **Nexora resuelve el problema con tres garantías que el mercado no ofrece:**

1. **Aislamiento real de datos** entre empresas — no como capa de código, sino en la base de datos (PostgreSQL RLS + FORCE + `api_user` NOBYPASSRLS). Lo que un cliente no puede ver, no existe para él.
2. **Trazabilidad como ciudadano de primera clase** — la pregunta que destruye o salva a cualquier plataforma de agentes: *¿por qué Nexora hizo esto?* Cada acción queda registrada con fuente, versión, regla y aprobador.
3. **Autonomía gobernada** — el empleado escala de autonomía solo con evidencia (5 éxitos en racha → autónomo; 2 fracasos → revocado). Nunca "IA que hace todo sola".

## 1.3 Qué estamos construyendo (la esencia arquitectónica, ya probada)

| Pieza | Estado | Qué garantiza |
|---|---|---|
| **Base multi-tenant con RLS + FORCE** | ✅ Certificada (Fase A 8/8, aislamiento E2E) | Un tenant jamás ve datos de otro |
| **Máquina de migraciones versionadas + prueba de oro** | ✅ 12 migraciones reproducibles desde base vacía | La plataforma entera se reconstruye en minutos (portabilidad a VPS) |
| **Onboarding seguro 0010** | ✅ Mergeado, staging end-to-end probado | Venta CRM → tenant → token de un solo uso (48h, consumo atómico) → el cliente define su propia contraseña |
| **Motor de ejecución** (outbox → worker → reintentos → DLQ, idempotencia) | ✅ SP3 certificado | Nada se pierde, nada se procesa dos veces |
| **Empleado #0** (dogfooding: vigila la propia plataforma) | ✅ A0–A3 definido, A2 por evidencia | El molde que después se vende a clientes, ya probado en casa |
| **Identidad de plataforma (0012)** | ✅ Certificada con prueba de oro | 7 permisos `platform:*` + rol global `Platform Founder` + bootstrap reproducible |
| **API B1 en Docker + Traefik** | ✅ 7 servicios, CI verde | La frontera HTTP, con JWT RS256 y sesión por cookie httpOnly |
| **Nexora Control** (panel del fundador) | 🚧 PRs 2–6 en curso | El fundador ve y opera el organismo sin terminal |

## 1.4 Dónde estamos (03/09, verificado en máquina)

`master 6bb6e74` · 12 migraciones · pulso `3|0|6|7|12` · DNI `7670634338808201248` íntegro · **7/7 contenedores bajo proyecto `infra` (D1 cerrado hoy, H1)** · salud base 10/10 / B1 11/11 (D2 a confirmar con 1 comando) · fundador con rol global reproducible · documentación al circuito en el repo (PR #5).

**Progreso contra la meta real: 0 de 4 condiciones de TERMINADO.** El "55-60%" que circulaba en un plan se descarta: medía infraestructura, no avance hacia el cliente (ver §3.4, N-02).

## 1.5 Hacia dónde vamos (la estrella polar)

Nexora está **TERMINADO** cuando se cumplen, juntas, estas 4 condiciones:

1. **Un cliente real y pago** activó su cuenta **solo**, por el onboarding 0010 (invitación → token → contraseña → login, sin mano nuestra).
2. Ese cliente tiene **un empleado digital funcionando** en un caso de uso concreto, con autonomía graduada y supervisión.
3. La plataforma corre en un **VPS** con HTTPS real, aislamiento multi-tenant probado **ahí**, y backup + restore verificado **ahí**.
4. El **fundador ve todo por el panel** sin tocar terminal.

**Tres horizontes:**
- **Horizonte 0 — Fundación** (JUL–SEP): ✅ terminado (SP2/SP3, rescate arqueológico, prueba de oro, migración a Linux Mint, B1 API, 0009/0010/0012, 7 servicios, identidad).
- **Horizonte 1 — Primer cliente pago** (SEP–NOV, este plan): puertas de seguridad, panel, **una** vertical, un mínimo empleado, VPS, piloto 30 días, primer pago por 0010.
- **Horizonte 2 — Escalar** (post-primer-cliente, backlog explícito): Web Factory, canal WhatsApp, más verticales y empleados (la familia NEXORA WEB / SALES / SUPPORT / OPS / INTELLIGENCE), observabilidad formal, equipo. Todo lo que no sirva para el Horizonte 1 vive ahí, no se pierde ni se improvisa.

**Pregunta filtro vigente para cada tarea:** *¿Esto acerca a una empresa real a tener un empleado digital?* Si la respuesta es NO → se justifica o se posterga.

---

# 2. MAPA GENERAL DE TRABAJO (ROADMAP)

## 2.1 La ruta completa, de un vistazo

```text
══════════════════════════════════ HECHO (JUL–SEP 2026) ══════════════════════════════
 23/07            29/07              04/08              15–20/08          24/08          02/09         HOY 03/09
 Rescate SP2  →  Prueba de oro   →  Linux Mint   →   B1 API real  →   0010 merge  →  0012 identidad →  D1 cerrado
 (volumen      6/6 + runner     (Windows fuera,  (login, RLS      (onboarding    (7 permisos     7/7 servicios
  huérfano)    migrate.mjs      netbook renace)  probado, B1)     + API Docker)  + panel auditado) bajo `infra`
    + fábrica de reset (31/07, sobrevivida con volúmenes intactos y DNI idéntico)

═══════════════════════════════ EN MARCHA (SEP–NOV 2026) ═════════════════════════════
 FASE 0          FASE 1            FASE 2              FASE 3             FASE 4
 ESTA SEMANA     1–2 semanas       2–3 semanas         2–6 semanas        2–6 semanas
 ┌─────────┐    ┌─────────┐      ┌─────────┐         ┌─────────┐        ┌──────────────────┐
 │Cierre    │    │PR-2 RBAC │      │PR-3 API  │         │Vertical  │        │T4.0 Página /activar│
 │D2 (15m)  │ →  │(puerta)  │ →   │/platform │  →     │elegida   │  →   │(la tarea perdida)│
 │D1 al repo│    │+ 2.2     │      │PR-4 panel│         │+ mínimo  │        │T4.1 Observabilidad│
 │PLAN v9   │    │roles     │      │PR-5 SSE  │         │empleado  │        │T4.2 Legal         │
 │Economía  │    │runtime   │      │PR-6 actos│         │+ (0011 si│        │T4.3 VPS + HTTPS  │
 │5 leads   │    │          │      │          │         │exige)    │        │T4.4 Backup VPS   │
 │Repo priv.│    │          │      │          │         │          │        │T4.5 Piloto 30 días│
 └─────────    └─────────┘      └─────────┘         └─────────┘        │T4.6 PRIMER CLIENTE │
      Puerta: v9 en repo + economía + 5 conversaciones   Puerta: H5 (panel)  Puerta: H6        │    PAGO por 0010 🎯   │
                                                                                              └──────────────────┘
 ════════════════ FRENTE COMERCIAL — EN PARALELO, NO ESPERA NADA (desde YA) ═══════════════
 23 leads Rosario ──► 5 discoveries (sem 1) ──► primeros mensajes (sem 1–4) ──► 1.ª venta
 (plata posible en 1–4 meses) ──────────────────────────────────────────────► alimenta FASE 3 y 4

 ════════════════════════ BACKLOG POST-PRIMER-CLIENTE (explícito, no se olvida) ═════════════
 Web Factory MVP (spec de 11 pasos) · Canal WhatsApp (Evolution vs Meta) · Nuevas verticales
 Empleados SALES/SUPPORT/OPS · Observabilidad formal · Equipo (bus factor) · Self-hosted vs gestionado
```

## 2.2 Hitos de alto nivel (estado 03/09)

| Hito | Señal de éxito | Estado |
|---|---|---|
| **H1** | 7 servicios en `infra` + salud 11/11 (B1) | 🟡 D1 cerrado hoy; formal con D2 + evidencia (T0.1/T0.2) |
| **H2** | Memoria versionada en el repo | 🟡 8 docs mergeados (PR #5); deuda: STAGING/RUNBOOK/ADD 23-24 (T2.5) |
| **H3** | `platform:onboarding` con prueba positiva y negativa | 🟡 0012 entregó la fundación; la negativa por request = PR-2 (T1.1) |
| **H4** | Ningún proceso de app como admin | ❌ abierto (T1.2) — **puerta G2, no negociable antes del VPS** |
| **H5** | Panel con datos reales | 🟡 prototipos auditados; PR-3/PR-4 (T2.1/T2.2) |
| **H6** | Empleado demo-able en una vertical | ❌ (T3.1/T3.2) |
| **H7** | VPS + HTTPS + aislamiento probado en el VPS | ❌ (T4.3) |
| **H8** | Backup + restore verificado en el VPS | ❌ (T4.4) |
| **H9** | Piloto real con valor medible | ❌ (T4.5) |
| **H10** | **Primer cliente pago activado solo por 0010 = TERMINADO** | ❌ (T4.6) |

## 2.3 Camino crítico

`Fase 0 → Fase 1 (PR-2 → 2.2) → Fase 2 (PR-3 → PR-4) → Fase 3 (vertical → empleado) → Fase 4 (/activar → observabilidad → legal → VPS → backup → piloto → cliente pago)`
**La puerta que habilita todo: PR-2 (RBAC).** Sin la puerta no hay `/platform`, no hay panel, no hay acciones. El frente comercial corre en paralelo y entrega los dos insumos que faltan: la vertical (Fase 3) y el cliente (Fase 4).

---

# 3. AUDITORÍA DE CONTRADICCIONES Y ERRORES

## 3.1 El problema de autoridad (severidad ALTA — RESUELTO)

Cuatro planes del 27/08/2026 se declaraban cada uno "el que manda" (COMPLETO: *"gana este"*; 0827: *"este plan manda"*; CONSOLIDADO: *"este archivo prevalece"*; CONTROL-Y-0011: *"aprobado como plan de trabajo"*), además de los mapas v6/v7/v8 y el PASAPORTE con reglas propias. **Dos (o cinco) documentos que se declaran el que manda = no manda ninguno**: cualquier copiloto nuevo ejecutaba un plan distinto según cuál abriera primero.

**Resolución adoptada:** jerarquía viva — ① este documento → `PLAN-MAESTRO-NEXORA-v9.md` (único plan) · ② `MAPA-GENERAL-NEXORA-v9.md` (único mapa) · ③ `PROTOCOLO-DE-TRABAJO-CON-JULES` (vigente, con corrección C-08) · ④ todo lo demás = **histórico fechado** (se conserva, no se borra: cuarentena aplicada a la memoria). Un solo plan vivo + un solo mapa vivo; cada hito actualiza el vivo y marca el anterior "superseded by vN". Aplicar en T0.3.

## 3.2 Contradicciones detectadas (C-01 … C-14)

| ID | Tema | Choque | Severidad | Resolución |
|---|---|---|---|---|
| **C-01** | Autoridad | 4 planes auto-declarados "el que manda" (ver 3.1) | **Alta** | ✅ v9 único (§3.1) |
| **C-02** | ADR-0011 / Web Factory | COMPLETO: Fase 5 "Web Factory MVP" pilar, 1–2 meses. Otros 7 docs: **archivado** hasta cerrar autorización/roles/panel; "subconjunto mínimo, no todo" | **Alta** | ✅ Mantiene archivado (consenso 7/8). Va al backlog post-primer-cliente; se reabre solo con vertical que lo exija + tajada mínima + checklist N-01 |
| **C-03** | Canal WhatsApp | COMPLETO: Fase 3 completa (contrato universal + adaptador Evolution/Meta + contenedor). En 0827 y todas las colas vigentes: **no existe** | **Alta** | ✅ Fuera del camino crítico → backlog. El canal (Evolution API vs Meta oficial) lo decide la **economía unitaria** (D-E): costos por conversación radicalmente distintos |
| **C-04** | Alcance total | COMPLETO: 7 fases ~5–7 meses. 0827: 5 etapas, "el mínimo empleado que resuelve ESE caso" | **Alta** | ✅ Estructura de 5 etapas con puertas (la de 0827, da rigor) + frente comercial y tabla de estimaciones de COMPLETO |
| **C-05** | Dónde va la seguridad | COMPLETO: 1.3/1.4 en Fase 1. 0827: Etapa 2 completa con puerta. CONTROL: Fases 2–3 | Media | ✅ Etapa 2 = 2.1 (✅ 0012) + 2.2 (❌ T1.2) + PR-2 (❌ T1.1). Puerta de salida = ambas cerradas |
| **C-06** | Empleado #0 `/graduacion` | Solo existe en COMPLETO (1.5) | Baja | ✅ Se incorpora como T2.6 (Baja) — no se omite |
| **C-07** | Salud 11/11 vs 10/10 | Planes certifican 11/11; estado actual 10/10 | Media | ✅ **No se perdió un órgano**: 10/10 = perfil `base`, 11/11 = perfil `B1` (`NEXORA_PROFILE=b1`, API arriba). Documentado desde el 15/08 (reporte §8) y en los mapas 20/08 y v6. El error fue cambiar denominador sin documentar (G3). Se cierra con 1 comando (T0.1). Referencia oficial: **B1** (D-C) |
| **C-08** | Numeración de PRs | Tres sistemas: GitHub secuencial (#2 infra, #3 = 0012, #4 pulso, #5 docs) · protocolo §8 ("PR 2 = identidad" — ya entregada) · brief+v8 ("PR 2" = middleware RBAC) | **Alta** | ✅ Dos registros: **(a) número de GitHub = hecho inmutable** · **(b) pasos lógicos renombrados `Control-1…7`** en el protocolo. El próximo trabajo = **PR-2-RBAC** (lógico) → saldrá como **PR #6 de GitHub**. Renombrar en T0.3 |
| **C-09** | Visibilidad del repo | PASAPORTE: privado. MAPA v8: **público por acceso de Jules**, pendiente evaluar privado + GitHub App | **Alta** (seguridad) | ⚠️ **D-A:** privado + GitHub App con acceso por repo; verificar técnica que el mecanismo de Jules lo acepte (T0.6) |
| **C-10** | Header MAPA v8 | v8 dice `master: 1f3fb43` pero PR #5 (`6bb6e74`) lo incluyó al repo ese mismo día | Baja | ✅ v8 = histórico "al momento de su escritura"; v9 arranca desde `6bb6e74` (T0.2/T0.3) |
| **C-11** | Usuario de la máquina | PASAPORTE (24/08): usuario **`luis`**. ADDENDUM 9 (04/08, instalación Mint): usuario **`nexora`**, equipo `nexora-pc` | Baja | ⚠️ Verificar con `whoami` al archivar la memoria (T2.7). Sin impacto práctico (rutas son `~/…`) |
| **C-12** | Nombres de archivo ≠ fecha interna | "pre-0009-2026-08-20" contiene el mapa del 15/08; las dos copias "sincronizadas" del 04/08 traen headers distintos (Día D "en curso" vs "ejecutado") | Baja | ✅ Higiene: toda versión lleva fecha en el nombre (v6/v7/v8 ya cumplen; los sueltos no) |
| **C-13** | HTMLs "claude" vs "chatgpt" | **Idénticos byte a byte** (25.687 B, diff vacío): el "concurso" de modelos tiene una sola respuesta de esos dos y la autoría es ambigua | Media | ⚠️ **D-F:** re-etiquetar con el modelo real o re-pegar la pregunta al modelo faltante. En el doc se trata como "Respuesta A (autoría ambigua)" |
| **C-14** | Archivos sin versión | `MAPA-GENERAL-NEXORA.md` fue v6 (24/08) en una tanda y el mapa 20/08 en otra; el **PDF sigue siendo el export del 04/08** (obsoleto desde el 15/08: trae el DNI viejo) | Baja | ✅ Al archivar: todo mapa lleva fecha; **regenerar o retirar el PDF** (T2.7) |

## 3.3 Puertas de salida declaradas: estado real

| Puerta | Estado | Evidencia / cierre |
|---|---|---|
| **G1** — Compose normalizado | ✅ **CERRADA hoy (D1)** | 7/7 contenedores `com.docker.compose.project=infra` · Redis/MinIO/Qdrant re-enganchados uno por uno · DNI íntegro · fecha interna de Qdrant `Aug 8 17:10` (cero bytes perdidos) · botón de encendido único. Faltante: evidencia en el repo (T0.2) + H1 formal con D2 |
| **G2** — Roles runtime (2.2) | ❌ **ABIERTA** | 2.1 avanzó con 0012, pero la separación de credenciales Ojo/Worker/Encargado/API/migraciones no se tocó, y se llegó a auditar el panel (Etapa 3) — justo lo que la puerta prohíbe. No es burocracia: H4 exige "ningún proceso de app como admin"; salir a VPS con procesos como admin convierte un bug de inyección en el fin de la empresa (fuga cruzada multi-tenant). **⚠️ D-B:** ejecutar después de PR-2 (recomendado) o postergar **firmado por escrito** con riesgo asumido. No se puede dejar en silencio |
| **G3** — Salud 11/11 → 10/10 | 🟡 **CASI CERRADA** | Hipótesis del fundador confirmada por evidencia (línea `Perfil: base` del healthcheck + diseño documentado 15/08). Cierre: 1 comando (T0.1) + nota en MAPA v9 + perfil oficial (D-C) |

## 3.4 Hallazgos y lo mal planteado (N-01 … N-19)

| ID | Hallazgo | Tratamiento |
|---|---|---|
| **N-01** | **ADR-0011 trae 2 bugs de diseño** (Codex, registrados): **P1** — policies de ejemplo usan `current_setting('app.current_tenant')` pero el wrapper real fija `app.current_tenant_id`; **P2** — habilita RLS **sin `FORCE ROW LEVEL SECURITY`**. Copiar el SQL del ADR §10 tal cual = policies que no matchean + puertas de bypass | **Checklist obligatoria** para cualquier tajada 0011: clave real + FORCE en las 6 tablas |
| **N-02** | La métrica "~55-60% del camino" no sale de ninguna definición de terminado | **Descartada.** Métrica que manda: las 4 condiciones de TERMINADO (hoy **0/4**) |
| **N-03** | No existe adaptador de estado de contenedores en la API (el panel "Organismo" lo necesita; el navegador jamás toca Docker) | Tarea de PR-3 (T2.1) |
| **N-04** | Panel B con supuestos abiertos: **[S1]** forma de `POST /login` sin confirmar contra el handler real · **[S4]** CSRF (cookie httpOnly + `credentials: include` sin token anti-CSRF) · `productManifest.ts` afirma cosas del backend por validar · router hash sin decidir · alias `@/` sin verificar · modo demo debe garantizarse por build | Cerrar los 6 antes de portar B (T2.2). CSRF: recomendación `SameSite=Strict` (panel same-origin detrás de Traefik) documentado en el contrato PR-3 |
| **N-05** | "H2 memoria versionada" parcial: `STAGING-0010.md` y `RUNBOOK-ACTIVACION.md` nunca exportados como archivos; ADD 23/24 sin consolidar | T2.5 (lote documental, antes de Etapa 5) |
| **N-06** | "Primeros comandos" del PASAPORTE obsoletos (esperan `5c15720`, 11 migraciones, pulso `…11`) | v9 los reemplaza con los valores actuales (T0.3) |
| **N-07** | Migración 0013: "verificar el número real antes de crearla" | Checklist en el diagnóstico de Jules: confirmar 0012 en journal y 0011 reservada |
| **N-08** | H1 de 0827 exige "healthcheck 11/11"; D1 cerró con 10/10 (base) | H1 formal al confirmar B1 11/11 + evidencia (T0.1/T0.2) |
| **N-09** | ADR-0011 dice "Accepted (24/08)" y en un doc "en desarrollo", mientras los mapas dicen "archivado" | Nota de estado en cabecera al moverlo a `docs/adr/`: **"Archivado por decisión — no implementar; 2 fixes pendientes (N-01)"** (T2.5) |
| **N-10** | El mapa del 04/08 escribe una **contraseña dev en texto plano** (`nexora_pass…123`), violando "secretos fuera de .md". La credencial fue rotada después (hotfix `3fc4fdc`) — riesgo cerrado | Al archivar ese mapa en el repo: **anonimizar**. El repositorio limpio no repite el valor |
| **N-11** | **Cuarentena de fósiles `_fosil_*` (9 objetos)**: el DROP final + `DROP SCHEMA outbox` quedó "pendiente tras días verdes" al 04/08 y ningún doc posterior lo registra | T2.7: censo en la base viva + decisión (Baja) |
| **N-12** | Pregunta abierta desde 04/08: ¿existe un repo **`nexora-core`** en la org? "Si es viejo → archivar, jamás borrar" | T2.7: verificar en GitHub (Baja) |
| **N-13** ⚠️ | **La página pública de activación `/activar` (`apps/web`) está perdida de todas las colas vigentes.** Declarada **obligatoria** en dos fuentes del 20/08 (plan §3 + mapa §10.5: token en `#token`, sin localStorage, CSP, mensajes indistinguibles, sesión posterior), marcada "(futura)" en el PASAPORTE, y ausente de v8, reporte 02/09 y briefs. **Sin ella la condición 1 de TERMINADO no es cerrable**: el cliente no tiene dónde activarse solo | **Nueva tarea T4.0 (Alta), precondición del primer cliente** |
| **N-14** | **Dos pares distintos "Panel A/B"**: ZIPs de Web Factory (20/08: A ejecutado en PG temporal → landing genérica descartado, se rescatan proyecto/pasos/config/renderer; B estático → se rescatan pipeline/eventos/auditorías) y prototipos de Nexora Control (02/09: A→docs, B→semilla) | Desambiguar en glosario: **"WF-A/WF-B"** vs **"PnA/PnB"** |
| **N-15** | Web Factory MVP ahora tiene spec completa: 11 pasos + prueba de cierre (3 negocios del mismo vertical → webs realmente distintas, sin datos inventados, sin imágenes rotas, mobile-first, QA medible) | Enriquece el backlog (Fase 2.8) |
| **N-16** | Menores: política ESLint del monorepo pendiente (el "lint" de CI es typecheck) · `package-lock.json` npm en `apps/orchestrator` (vs pnpm, ADR-0004) sin registro de cierre · PDF del mapa obsoleto | T2.7 / backlog |
| **N-17** ☠️ | **INCIDENTE CRÍTICO DE SEGURIDAD:** `github-recovery-codes.txt` — el set completo de **16 recovery codes de 2FA de GitHub** (org `EmpresaNexusIA`) **viajó por un chat de IA** | Ver §3.6 — acciones de hoy |
| **N-18** | JSON de cuarentena `cuarentena-outbox-25cc0597….json` (evento `user.soft_deleted`, 20/08, PENDING, deletedBy nulo) | ✅ **Resuelto:** es el **incidente de seed 0009 documentado** en el mapa 20/08 §8.3 (fixture "Juan Miembro" → soft-delete → evento exportado a cuarentena **con SHA256** → outbox restaurado a 3). Historia certificada, no deuda. Verificación opcional: id ausente en `audit.outbox` (T2.7) |
| **N-19** | **Tensiones de los ejercicios estratégicos** "Si Nexora fuera tuyo" (ver §5.12): (1) producto de entrada — web vs recepción-seguimiento vs "mínimo empleado del caso" · (2) precio — setup USD 150–500 + 50–150/mes (Respuesta B) vs tabla actual · (3) "tajada 0011 mínima en semana 2" vs "archivado hasta panel" · (4) B posterga el panel vs plan lo centra en H5 | No son errores: **insumos de decisión** — alimentan T0.4 (precio), T0.5/T3.1 (producto/vertical), T3.3 (0011), T2.2 (scope MVP: ambas respuestas coinciden en "panel mínimo que responde, sin gráficos bonitos") |

## 3.5 Valores obsoletos (NO usar de referencia)

| Obsoleto | Vigente |
|---|---|
| Pulso `…6\|3` (04/08) · `…7\|9` (15/08) · `…7\|10` (20/08) · `…7\|11` (24–27/08) | `3\|0\|6\|7\|12` (→ `…13` con 0013) |
| `master` `510114a` · `1ae3998` · `5c15720` · `2d29e84` · `50bc33d` · `1f3fb43` | `6bb6e74` (02/09) |
| DNI `7665021859759763490` (fantasma, encarcelado) · `7665856709823602729` (era WSL) | `7670634338808201248` (nace con la migración a Mint, 04/08) |
| 3 / 6 contenedores · 3 / 9 / 10 / 11 migraciones | 7 contenedores · 12 migraciones |
| Backup 23/07 · 04/08 (29.257 B) · 16/08 · 20/08 · 26/08 (43K) | 02/09: `nexora_dev_20260902_101800.sql` (48K) + roles (1,5K) |
| "0010 en rama, falta staging + merge" (v6/PASAPORTE) | Mergeado (`2d29e84`), staging end-to-end hecho |
| "Repo privado" (PASAPORTE/08-04) | **Público** (por Jules) — pendiente D-A |
| "11/11" sin citar perfil · PDF del mapa (export 04/08) | base 10/10 / B1 11/11 · PDF a regenerar o retirar (T2.7) |

## 3.6 ☠️ Incidente crítico de seguridad (N-17) — acciones de HOY

El archivo `github-recovery-codes.txt` (16 líneas × 12 chars = formato exacto de recovery codes de 2FA de GitHub) expone **acceso a la cuenta/org sin 2FA** a quien lo tenga. Por la regla propia (*"secreto expuesto = rotado"*) y el PROMPT-COPLUTO (*protección total*), el set se considera **comprometido por definición**:

1. **Regenerar los codes HOY** (GitHub → Settings → Password and authentication → Two-factor → *Regenerate*): invalida al set viejo; no requiere saber cuáles son.
2. **El documento consolidado no los contiene** ni en bruto ni en parte (política de anonimización, como la de N-10).
3. El set viejo → bóveda offline como material muerto (o destrucción, preferible) después de regenerar.
4. Revisar por qué subió (lo más probable: arrastre accidental al armar los bloques). Si fue intencional como resguardo: el único lugar válido es la bóveda, nunca el chat.
5. Mientras no se regenere: dar por hecho que **cualquiera con el archivo entra a la org** — incluida la plataforma.

## 3.7 Lo que está muy bien y NO se toca

- **Las reglas de operación** ("cero suposiciones", "prueba de oro", "cuarentena antes que DROP", "no push a master", "un comando por vez"): son las que evitaron desastres reales.
- **RLS + FORCE + `api_user` NOBYPASSRLS**: el aislamiento vive en la capa correcta (la base), no en código de aplicación.
- **Migraciones versionadas + prueba de oro en urna**: poder levantar la plataforma entera desde cero es un activo enorme.
- **Definición de terminado atada a un cliente pago**, no a features.
- **"Un PR no existe hasta que `git ls-remote` muestra su ref"**: detectó una entrega fantasma antes del merge, costo cero.
- **El chasis, en general:** la disciplina técnica está por encima de la media. El problema nunca fue el chasis: eran dos mapas y nadie manejando hacia el cliente.

---

# 4. PLAN DE TRABAJO INTEGRAL Y ÚNICO

## 4.0 Reglas del plan

- **Autoridad:** esta sección es el plan. Al volcarla a `docs/PLAN-MAESTRO-NEXORA-v9.md` (T0.3) reemplaza a los 4 planes del 27/08 (histórico fechado). Estructura: 5 etapas con **puertas de salida** (la de 0827) + frente comercial continuo (la de COMPLETO) + backlog explícito.
- **Prioridades:** **Alta** = bloquea al primer cliente pago o es riesgo de seguridad/dinero · **Media** = habilita o acelera · **Baja** = prolijidad, se agrupa en lotes.
- **Métrica de progreso:** solo las 4 condiciones de TERMINADO. Cero porcentajes inventados.
- **Comandos de verificación actualizados** (reemplazan los del PASAPORTE — N-06):

```bash
cd ~/dev/nexora-platform
git fetch origin && git status                      # esperado: master, árbol limpio
git log --oneline origin/master -3                   # esperado: 6bb6e74 (PR #5)
bash infra/scripts/healthcheck.sh                    # esperado: Perfil: base · 10/10
NEXORA_PROFILE=b1 bash infra/scripts/healthcheck.sh  # esperado: 11/11 con API arriba
docker inspect --format '{{.Name}} {{index .Config.Labels "com.docker.compose.project"}}' \
  $(docker ps -q)                                    # esperado: 7 nombres, todos "infra"
docker exec nexora-postgres psql -U nexora_admin -d nexora_dev -t -A -c \
  "select (select count(*) from audit.outbox),(select count(*) from orchestrator.dead_letter_queue where resolved_at is null),(select count(*) from pg_trigger where not tgisinternal),(select count(*) from pg_policy),(select count(*) from drizzle.__drizzle_migrations)"
# esperado: 3|0|6|7|12
```

## 4.1 ACCIÓN 0 — INMEDIATA (hoy, antes que cualquier otra) · **Alta (seguridad)**

**T0.0 — Regenerar GitHub recovery codes (N-17)** — seguir §3.6 paso a paso. DONE: set nuevo generado y guardado en bóveda offline; set viejo descartado; nota en MAPA v9 ("códigos rotados 03/09").

## 4.2 FASE 0 — Inmediato (esta semana) · **Alta**
**Objetivo:** cerrar las puertas abiertas, dejar un solo plan vigente y poner la primera información del cliente dentro del proyecto.

| T | Tarea | Detalle / DONE | Prio |
|---|---|---|---|
| **T0.1** | **Cerrar D2** (15 min) | `NEXORA_PROFILE=b1 bash infra/scripts/healthcheck.sh` → esperado **11/11** con API arriba. Anotar en MAPA v9: "base 10/10 · B1 11/11; referencia oficial: B1" (D-C). G3 ✅. H1 formal. | Alta |
| **T0.2** | **Registrar D1 en el repo** (30 min, PR documental) | Evidencia H1: 7× `com.docker.compose.project=infra` · DNI íntegro · Qdrant `Aug 8 17:10` (cero bytes perdidos) · health + pulso. | Alta |
| **T0.3** | **PLAN v9 + MAPA v9 en `docs/`** (1 h) | Volcar §4. Base 5 etapas con puertas + comercial de COMPLETO. Renombrar protocolo §8 → `Control-1…7` (C-08). Corregir headers (C-10) y comandos (N-06). Web Factory + WhatsApp → backlog. Archivar v6/v7/v8 como "histórico". | Alta |
| **T0.4** | **Economía unitaria** (1 tarde) — *el trabajo de mayor retorno disponible* | 1 archivo en `docs/`: costo por cliente/mes vs precio. Partidas: tokens LLM × conversaciones/mes; VPS + ancho (input: estimación 04/08 de ~USD 5–20/mes); almacenamiento MinIO/Qdrant; **canal WhatsApp (Evolution vs Meta)**; tiempo de soporte. **Inputs del ejercicio estratégico:** tabla de la Respuesta B (setup USD 150–500 + mensualidad 50–150) vs tabla actual (web 100–150+15/mes; SaaS 150–300/mes). Output: ¿cierra el margen? precio, vertical, canal (D-E), dimensionado VPS. | Alta |
| **T0.5** | **5 conversaciones de discovery** (esta semana) | 5–7 conversaciones o 2 semanas de tope; ≥2–3 contactos fríos de los 23 leads. Guion de hechos: *¿qué pasó? / ¿qué intentaste? / ¿qué te costó? / ¿qué aceptarías probar? / ¿qué aceptarías pagar?* + preguntas del ejercicio B (¿por qué canal entran las consultas? ¿cuántas quedan sin responder? ¿qué información NUNCA debe inventar un sistema? ¿qué acciones necesitan aprobación?). Sin vender solución predeterminada; frases textuales registradas. Output: datos de vertical (T3.1) + primer candidato a cliente pago. | Alta |
| **T0.6** | **Decisión visibilidad del repo** (D-A) | Privado + GitHub App con acceso por repo seleccionado; verificar técnica que el mecanismo de Jules (rama de sesión + sufijo) publique contra repo privado. Si no es viable, documentar el riesgo intermedio. | Alta |

**PUERTA DE SALIDA FASE 0:** D2 documentada (G3 ✅, H1 ✅) + D1 evidenciada + v9 en `docs/` + economía con decisiones + 5 conversaciones + visibilidad decidida + **recovery codes regenerados (T0.0)**.

## 4.3 FASE 1 — Seguridad real (cerrar Etapa 2) · **Alta**

| T | Tarea | Detalle / DONE | Prio |
|---|---|---|---|
| **T1.1** | **PR-2 — Middleware RBAC** (brief vigente: `BRIEF-PR2-RBAC-…`) | Flujo por protocolo: auditoría → plan → **OK explícito** → implementación. Alcance (nada más): **(1)** migración **0013** (verificar número, N-07) con función angosta `public.api_get_user_permissions(p_user_id uuid)` `SECURITY DEFINER`, `search_path` fijo, ACL demostrada (`nexora_admin:EXECUTE, api_user:EXECUTE`, sin PUBLIC); **(2)** plugin `apps/api/src/plugins/rbac.ts` con `requirePlatformPermission`, resolución por request (los permisos **no** viajan en el JWT — decisión cerrada), sin caché en V1; **(3)** suite con **las 5 llaves**: 401 sin JWT · 403 comercial · 200 fundador con permiso exacto · 403 `role_id NULL` · 403 permiso insuficiente + aislamiento por parámetro. Urna 0000→0013, fixtures `BEGIN`/`ROLLBACK`, rama `feat/0013-platform-rbac`, `git ls-remote` obligatorio. **+ PR hermano de pulso `3\|0\|6\|7\|13`** (proceso ya ejecutado en PR #4). Cierra H3. | Alta |
| **T1.2** | **Roles runtime mínimos (2.2)** — *la puerta G2* | Separar credenciales Ojo/Worker/Encargado/API/migraciones; cada proceso arranca con su credencial y **falla** (prueba negativa) fuera de su permiso. DONE: **ningún proceso de app como admin** (H4) + matriz de permisos en ADR corto. ⚠️ Si se posterga: **escrito firmado con riesgo asumido** (D-B). Recomendación: ejecutar, después de T1.1 y antes de cualquier VPS. | Alta (puerta) |

**PUERTA DE SALIDA FASE 1 (= cierre Etapa 2):** PR-2 mergeado con 5 llaves verdes + 2.2 cerrada (o postergación firmada) + pulso `…13` certificado + backup post-0013 en bóveda.

## 4.4 FASE 2 — Visibilidad: Nexora Control (Etapa 3) · **Alta (T2.1/T2.2) · Media (T2.3/T2.4)**

| T | Tarea | Detalle / DONE | Prio |
|---|---|---|---|
| **T2.1** | **PR-3 — API `/platform/*` de solo lectura** | Antes de código, **los 3 gates** (del PnA, ya son regla): (01) contrato `/platform/*` **aprobado por escrito** · (02) **diccionario del pulso** escrito (qué cuenta cada número, ventana, tabla — hoy nadie puede explicarlo) · (03) **origen del estado de contenedores y del registro de producto**. La **matriz de fuentes por pantalla** del PnA va a `docs/` y alimenta el brief. **Incluye el adaptador de estado de contenedores en la API** (N-03). Rutas: `GET /platform/overview · health · services · clients · clients/:id · tenants · tenants/:id · users · onboarding · events · outbox · dlq · runtime/executions · runtime/projects`. Toda ruta tras `requirePlatformPermission`. | Alta |
| **T2.2** | **PR-4 — `apps/control` V1** (semilla: PnB; PnA **no** entra como código) | Antes de portar, cerrar los 6 puntos (N-04): CSRF `[S4]` (recomendación `SameSite=Strict`, documentado) · `[S1]` contra el handler real · router (D-D: recomendación BrowserRouter + fallback SPA) · alias `@/` (tsconfig/vite) · **demo garantizado por build** (CI grepea el bundle) · cada línea de `productManifest.ts` contrastada contra el repo. **Scope MVP mínimo** (acuerdo de las 2 respuestas del ejercicio N-19: "responder las preguntas, sin gráficos bonitos"): Inicio (las 10 preguntas de éxito en <2 min), Organismo/servicios, Clientes, Onboarding, Actividad, Errores, Producto (FUNCIONA/EN CONSTRUCCIÓN/PENDIENTE/ARCHIVADO). React·Vite·TS·Tailwind · `control.nexora.localhost` · cookie httpOnly · solo lectura. DONE: spot-check de 3 números = consultas directas (H5). | Alta |
| **T2.3** | **PR-5 — Tiempo real** | SSE (más simple que WebSocket para servidor→panel) + reconexión + fallback polling 15s/60s/60s (pausa si pestaña no visible) + "Actualizado hace X segundos". Eventos: caída de contenedor, error API, activación, escalación, cambio de estado, nueva ejecución, outbox, entrada en DLQ. | Media |
| **T2.4** | **PR-6 — Acciones administrativas controladas** | Crear cliente, provisioning controlado, reenvío de invitación, retry/resolver eventos. Cada acción: **explicación → confirmación → ejecución → auditoría → resultado**. `POST /platform/clients · /platform/onboarding/:id/resend · /platform/events/:id/retry · /platform/events/:id/resolve`. (No bloquea TERMINADO: mientras tanto, provisioning por CLI `provision-client.ts`.) | Media |
| **T2.5** | **Lote documental** (PR documental) | (1) Exportar `STAGING-0010.md` y `RUNBOOK-ACTIVACION.md` desde la historia certificada · (2) consolidar ADD 23/24 al reporte maestro · (3) ADR-0011 a `docs/adr/` con nota de estado (N-09) · (4) actualizar reporte integral (el de 16/08) · (5) archivar v6/v7/v8 + mapas sueltos **con fecha en el nombre** (C-12/C-14) y **anonimizar la contraseña dev del mapa 04/08** (N-10) · (6) retiro/regeneración del PDF (N-16). Cierre completo de H2. | Baja (fechar: antes de Etapa 5) |
| **T2.6** | **Empleado #0: comando `/graduacion`** | Ver progreso A2 por Telegram; si la DLQ suma vida real, que la graduación actúe. (C-06: existía solo en COMPLETO.) | Baja |
| **T2.7** | **Lote de higiene técnica y de memoria** | (1) Censo de fósiles `_fosil_*` en la base viva (deben ser 9) + decisión del DROP final + `DROP SCHEMA outbox` (N-11) · (2) confirmar que el evento `25cc0597…` no existe en `audit.outbox` (N-18, opcional) · (3) `package-lock.json` npm en `apps/orchestrator` (N-16) · (4) repo `nexora-core`: existe → archivar si es viejo, jamás borrar (N-12) · (5) `whoami`: ¿`luis` o `nexora`? (C-11) · (6) PDF del mapa: regenerar o retirar (C-14). | Baja |

**PUERTA DE SALIDA FASE 2 (= cierre Etapa 3):** el fundador responde en **<2 minutos** las 10 preguntas (¿está viva? / ¿qué funciona? / ¿qué falló? / ¿qué clientes tengo? / ¿en qué estado? / ¿qué onboarding pendiente? / ¿qué se construye? / ¿qué parte del 0011? / ¿qué pasó recientemente? / ¿próximo paso?) **sin terminal** (H5) + H2 cerrado.

## 4.5 FASE 3 — Producto: vertical y empleado mínimo (Etapa 4) · **Alta**

| T | Tarea | Detalle / DONE | Prio |
|---|---|---|---|
| **T3.1** | **Elegir vertical + caso de uso** | **Una** vertical (la del problema más claro y el cliente más cercano, **según discovery T0.5** — los ejercicios apuntan a inmobiliarias/servicios, pero el dato manda) y **un** caso medible ("atiende consultas y agenda turnos", "responde y deriva leads"). Regla: **construir el mínimo empleado que resuelve ESE caso**, no la plataforma entera. "Ningún producto para ese segmento" es resultado válido. | Alta |
| **T3.2** | **Construir el empleado de esa vertical** | Sobre Empleado #0 (A0→A3) + orquestador SP3: herramientas autorizadas del caso; límites y supervisión humana en acciones de riesgo; **trazabilidad: cada acción registrada** (*¿por qué hizo esto?*). Límites explícitos al cliente (confianza por lo que hace **y** por lo que se niega a hacer). DONE: demo-able con registro de decisiones (H6). | Alta |
| **T3.3** | **Tajada 0011 — solo si el caso lo exige** | Opción base: **0011-A** (`agent_executions` + `agent_projects` + tenant isolation + estados + prueba de oro, migración 0011). Opción alternativa (ejercicio B): **tajada vertical** (executions + operational_events + agent_decisions + provenance + escalamiento humano + estados básicos). **Siempre con checklist N-01** (`app.current_tenant_id` + FORCE RLS). | Condicionada (Media si T3.2 la exige) |

**PUERTA DE SALIDA FASE 3:** empleado **funcionando en una vertical, demo-able, con trazabilidad** (H6). El 0011 completo sigue archivado si no se usó.

## 4.6 FASE 4 — Lanzamiento: VPS, piloto y primer cliente pago (Etapa 5) · **Alta**

| T | Tarea | Detalle / DONE | Prio |
|---|---|---|---|
| **T4.0** | **Página pública de activación `/activar` (`apps/web`)** — *la tarea perdida (N-13)* | Definida y declarada **obligatoria** en el plan y mapa del 20/08: token desde fragmento `#token` (borrado inmediato) · sin localStorage · password + confirmación · POST seguro a la API · sesión posterior · CSP y cabeceras estrictas · responsive/accesible · mensajes **indistinguibles** para token inválido/vencido/usado. `app.nexora.com` = app pública del producto, con el mismo rigor que la API. **Precondición de que el cliente se active solo (condición 1 de TERMINADO).** | **Alta** |
| **T4.1** | **Observabilidad mínima + canal de soporte ANTES del VPS** | El día que un cliente real dependa de esto hay que saber que algo se rompió **antes que él**. Alertas: caída de contenedor, error API, crecimiento de DLQ (Empleado #0 ya vigila readiness/DLQ: se le conectan, no se construye plataforma formal — esa va al backlog). Canal de soporte con **tiempo de respuesta declarado** en el contrato. | Alta |
| **T4.2** | **Legal antes del primer pago** | Conversaciones de WhatsApp de clientes de clientes = **dato personal de terceros en Argentina**: contrato con el cliente, política de privacidad, T&C, acuerdo de tratamiento de datos, retención/borrado, **figura fiscal para facturar recurrente**. El primer cliente pago necesita un contrato, no solo un `INSERT`. | Alta |
| **T4.3** | **VPS: dimensionar y desplegar** | Dimensionado desde T0.4 (input 04/08: ~USD 5–20/mes). Compose + Traefik + **HTTPS real (Let's Encrypt)** + dominio del producto + dominio del cliente cuando aplique. DONE: healthcheck verde **en el VPS** + cruce A→B denegado **en el VPS** (H7). | Alta |
| **T4.4** | **Backup + restore EN el VPS** | Automático programado + restore probado **en el VPS** (no vale el de la máquina de desarrollo): urna, 0 FAIL (H8). | Alta |
| **T4.5** | **Piloto real (30 días, reversible)** | 1 cliente del frente comercial + la vertical T3.1. KPIs definidos antes de empezar (consultas atendidas, % éxito, tiempo de primera respuesta, leads calificados, seguimientos, derivaciones humanas, errores, intervenciones manuales). **Piloto reversible** (ejercicio B): alcance cerrado, un solo canal, sin contrato largo, apagado inmediato si no sirve, datos bajo control del cliente, revisión semanal. El cliente debe poder decidir rápido, probar rápido, medir rápido. DONE: valor medible (H9). | Alta |
| **T4.6** | **Primer cliente pago por onboarding 0010** | El cliente entra **solo** por 0010: invitación → token (un uso, 48h) → `/activar` (T4.0) → contraseña → login. **El fundador NO interviene manualmente en la activación**; queda registrada en outbox/auditoría. Validación comercial y técnica a la vez. DONE: activación sin intervención + **pago recibido** (H10 = **TERMINADO 🎯**). | Alta |
| **T4.7** | **Caso de éxito documentado** | Frases textuales del cliente + KPIs medidos — sin métricas inventadas ni "aumentamos ventas 10x" (regla de integridad, compartida por ambos ejercicios). → vender a los otros leads. | Media |

**PUERTA DE SALIDA FASE 4:** las 4 condiciones de TERMINADO (H10).

## 4.7 FRENTE CONTINUO — Comercial (no espera a nada técnico) · **Alta**

| Cuándo | Acción |
|---|---|
| **Esta semana** | Las 5 conversaciones de discovery (T0.5) |
| Semana 1 | Primeros mensajes con guion (empezar por un conocido si lo hay) · configurar Spoki (secretaria/recepcionista) |
| Semanas 2–4 | 10–15 mensajes/semana · **primera venta** (web única / bot / combo: instalación + mensualidad) |
| Mes 2–3 | 2–4 clientes (SaaS 150–300/mes) · **un cliente entra por onboarding 0010** |
| Mes 4 | Meta realista **USD 800–1.200/mes** + (opcional) AI Trainer |

**Método de venta (consenso de los dos ejercicios estratégicos):** venta directa, no publicidad masiva. Mensaje basado en el problema, no en el producto: *"estuve viendo la presencia online de [negocio] y encontré 3 cosas que probablemente estén haciendo perder consultas desde el celular — preparé un ejemplo rápido"*; vender con **demostración** (ASÍ ESTÁS HOY vs ASÍ PODRÍAS ESTAR), no con PowerPoint; la confianza se diseña con 5 cosas: mostrar el resultado primero · transparencia (nunca "la IA hace todo sola") · **dominio del cliente** (no sentirse atrapado) · **soporte humano** (si algo pasa, ¿a quién llamo?) · casos reales (el primer cliente genera más que plata: genera confianza comercial). No vender "IA", "agentes" ni "automatización": vender *"Decime qué trabajo te está sacando tiempo. Veamos si Nexora puede hacerlo."*

**Reglas no negociables:** no prometer magia · no vender autonomía inexistente · sin métricas/testimonios/clientes inventados · precios razonables · webs únicas · dominio del cliente · aislamiento por red · bots v1 sobre Spoki · cobrar por valor real · **cada cliente vendido → CRM (`vendido`) → onboarding 0010**.

## 4.8 BACKLOG POST-PRIMER-CLIENTE (explícito: no se olvida, no está en el camino crítico)

1. **Web Factory MVP** — spec completa (N-15): ADR/contrato SiteConfig (Zod) → un vertical → brief real → evidencia con fuentes → componentes por vertical → 3 composiciones distintas → activos en MinIO → revisión humana → Playwright/Axe/Lighthouse → export estático sin acceso a la base Nexora. **Prueba de cierre:** 3 negocios del mismo vertical producen webs realmente diferentes, sin datos inventados, sin imágenes rotas, mobile-first, QA medible. Estándar de calidad: el **Checklist Inteligente** (§5.10).
2. **Canal WhatsApp** (D-E, según T0.4): contrato de mensaje universal (id, tenant_id, contact_id, channel, direction, content, correlation_id — la identidad del contacto es independiente del canal: Juan es Juan en WhatsApp y en web) + adaptador (Evolution API vs Meta oficial) + contenedor nuevo aislado (jamás toca el cluster del taller; por tenant).
3. **Más verticales y empleados** (la familia NEXORA WEB / SALES / SUPPORT / OPS / INTELLIGENCE) — la NEXORA DATA INTEGRITY POLICY de ADR-0011 (NO_FABRICATION, SOURCE_REQUIRED, INFERENCE_MUST_BE_MARKED, PUBLIC_CONTENT_REQUIRES_VERIFICATION, LEGAL_CONTENT_REQUIRES_APPROVAL) se adopta por todos.
4. **Observabilidad formal** (métricas SaaS, facturación, dashboards) y **equipo**: qué se documenta para que otro pueda tomar el proyecto + primer rol a contratar y con qué plata (bus factor = 1).
5. **Evaluación self-hosted vs gestionado** (1 página): comparar alternativas gestionadas para las piezas que no son el diferencial (el diferencial es el empleado digital, no operar Postgres/Redis/MinIO/Qdrant/Traefik). La soberanía de datos es argumento de venta real en pymes; la decisión solo necesita haber sido **discutida**, no necesariamente cambiada.
6. **Política ESLint del monorepo** (revisita declarada en el 15/08) · **AI Trainer** (opcional, mes 4).

## 4.9 Estimación honesta (ritmo del taller: 4–6 h/día del fundador + copilotos)

| Bloque | Tiempo | Nota |
|---|---|---|
| T0.0 + Fase 0 | Esta semana | Lo técnico son horas; el discovery y la economía son la sustancia |
| Fase 1 | 1–2 semanas | El proceso PR ya está rodado (0012 tomó 1 día de ciclo completo) |
| Fase 2 | 2–3 semanas | PR-3 + PR-4 son el grueso; PR-5/6 pueden seguir tras el primer cliente |
| Fase 3 | 2–6 semanas | Depende del caso: lo pequeño se agradece (mínimo empleado) |
| Fase 4 | 2–6 semanas | /activar + VPS + piloto 30 días + cliente pago |
| **Comercial (paralelo)** | **Plata posible en 1–4 meses** | No espera a nada técnico |

---

# 5. REPOSITORIO DE INFORMACIÓN LIMPIA (referencia, no tareas)

## 5.1 Identidad y estado del organismo

| Dato | Valor |
|---|---|
| **DNI del organismo** | `7670634338808201248` (íntegro al 03/09, verificado tras D1). **Línea genealógica:** fantasma `7665021859759763490` (segundo engine WSL, encarcelado 29/07, nada borrado) → oficial WSL `7665856709823602729` (sobrevivió el factory reset 31/07 con WAL recovery) → **actual** (nace con la migración a Linux Mint, 04/08: "organismo nuevo, mismos recuerdos") |
| **Pulso operativo** | `3\|0\|6\|7\|12` = `outbox\|dlq\|triggers\|policies\|migraciones` · **línea:** `3\|0\|6\|6\|3` (post-Mint) → `…7\|9` (15/08) → `…7\|10` (20/08) → `…7\|11` (24–27/08) → `…7\|12` (02/09) → `…13` (con 0013) · diccionario completo = gate 02 de PR-3 |
| **Firma estructural (prueba de oro)** | `12\|7\|6` = `migraciones\|policies\|triggers` — **no confundir con el pulso** (órdenes distintos) |
| **Salud** | Perfil base **10/10** (`bash infra/scripts/healthcheck.sh`) · Perfil B1 **11/11** (`NEXORA_PROFILE=b1`, API arriba) — diseño documentado desde el 15/08; confirmar D2 (T0.1); referencia oficial: B1 |
| **7 servicios (y solo 7)** | `nexora-postgres` · `nexora_traefik` · `nexora_whoami` · `nexora-redis` · `nexora-minio` · `nexora-qdrant` · `nexora_api` — todos bajo proyecto `infra` (D1) |
| **Compose** | Proyecto `infra` · red externa `nexora_net` · **botón de encendido único** (compose raíz) · imagen `infra-api` (Node 22, pnpm 11.10.0) |
| **Base viva** | `nexora_dev` · máquina: Linux Mint XFCE nativo en netbook (migrada de Windows el 04/08; usuario por verificar: `luis` vs `nexora` — C-11) |

## 5.2 Repositorio y git

| Dato | Valor |
|---|---|
| Repo | `EmpresaNexusIA/nexora-platform` — **público por acceso de Jules**; pendiente D-A (privado + GitHub App) · pregunta abierta: repo `nexora-core` (N-12) |
| `master` vigente | `6bb6e74` (02/09) |
| PRs mergeados (GitHub) | **#2** `50bc33d` API Docker (rama `feat/infra-api-docker-20260827`, commits `e589439`/`ee09518`/`98b8832`) · **#3** `a34c8b7` migración 0012 + bootstrap (6 archivos, +226/−2) · **#4** `1f3fb43` pulso (1 línea, originado por P2 de Codex) · **#5** `6bb6e74` 8 docs +2308/−0 |
| Commits clave (línea de tiempo) | `d7f8b56` (sp3-complete, 23/07) · `550cd8d` (saga migraciones, 29/07) · `510114a` (bugs SP3, 01/08) · `728c38e` (stop) · `075c52f` (hash entregas) · `e931bc5` (CI compose) · `d74673a` (multi-tenant E2E) · `d3f8f70` (backup+restore) · `6c06293` (ADR-0009) · `0c570d1` (password/login) · `164944e` (base B1) · `328a2b2` (Zod 4 + host seguro) · `a03f779` (wrapper tenant + hardening) · `e20be0b` (create-admin seguro) · `1ae3998` (CI typecheck) · `3fc4fdc` (secrets hotfix) · `87171b9` (restore honesto) · `5c15720` (0009) · `2d29e84` (0010) · `db24bb7` (Empleado #0 vigila API) · `719f48b` (fix `BEGIN`/`ROLLBACK`) · cherry-picks `82c11ee`/`2c4ba03` |
| Entidad fantasma (lección) | SHA `88d69ac`: "PR listo" sin ref remota; detectado antes del merge por `git ls-remote` |
| Autoría | Commits de código: `google-labs-jules[bot]`; cherry-picks sobre rama limpia |
| Próxima rama | `feat/0013-platform-rbac` (PR-2-RBAC → será PR #6 de GitHub) |

## 5.3 Base de datos y seguridad

| Dato | Valor |
|---|---|
| Runner oficial | `node migrate.mjs` — **`drizzle-kit migrate` PROHIBIDO** (muere en silencio, exit 0, en bases vacías — lección 28/07) · **jamás escribir el literal `--> statement-breakpoint` en prosa de .sql** (auto-sabotaje documentado) |
| Migraciones | 0000–0012 · 0000 v2 / 0001 / 0002 v3 = maquinaria SP2 rescatada (hashes `48dc9ba2…`/`abe45e25…`/`57b8ffe1…`, diary ids 1/2/4) · **0011 reservada a ADR-0011** · 0013 = RBAC (pendiente) · 0009: RBAC íntegro + PK compuesta + grants api_user a RBAC/CRM = 0 · 0012: 7 permisos `platform:*` + rol `Platform Founder` (`tenant_id IS NULL`) + bootstrap |
| **7 permisos de plataforma** | `platform:control:read/manage` · `platform:onboarding` · `platform:runtime:read/manage` · `platform:backup:read` · `platform:events:read` (lectura separada de acción; **no existe** `platform:admin`) |
| Fundador | `admin@nexora.local` → `Platform Founder` (tenant plataforma `00000000-0000-7000-8000-000000000001`) · `admin@nexora.app` = rol Administrador de otro tenant, **no es fundador** |
| Roles y reglas | `api_user`: LOGIN, NOBYPASSRLS, sin acceso directo a RBAC/CRM · `nexora_admin`: solo migraciones/admin · `nexora_maintenance_role` (NOLOGIN) · apps jamás `postgres` · API jamás `nexora_admin` · seed bloqueado salvo `ALLOW_DEV_SEED=true` |
| Bootstrap | `infra/scripts/create-admin.sh`: aborta si falta 0012 · asigna por JOIN al rol (nunca email hardcodeado) · corre como `nexora_admin` vía `docker exec` · `NEXORA_DB_NAME=<urna>` para pruebas |
| Onboarding 0010 | `complete_client_activation()` `SECURITY DEFINER` · **ACL: `nexora_admin:EXECUTE, api_user:EXECUTE`, sin PUBLIC** (el `0\|1\|1\|1` inicial fue falso positivo del patrón) · token: 32 bytes, SHA-256, **consumo atómico Redis Lua GET+DEL (un uso)**, TTL 48h, reenvío invalida el anterior · estados: `vendido→onboarding→pending_activation→invited→active` · email case-insensitive (`LOWER`) · 400 uniforme + anti-timing ~200ms · doble rate limit · bcrypt cost 10 |
| Integridad de Core | **Eliminaciones físicas prohibidas** (soft-delete `deleted_at`; el trigger anti-DELETE se verificó en vivo el 02/09) · **fósiles:** 9 objetos `_fosil_*` cuarentenados 29/07 (outbox v1/v2 + helpers); DROP final sin registrar → censo en T2.7 · **cuarentena de eventos:** `cuarentena-outbox-25cc0597….json` = incidente de seed 0009 (SHA256 `9629a824…` registrado en mapa 20/08 §8.3) |
| Backups (genealogía) | 23/07 rescate (`nexora-sp2-2026-07-23.sql` 33K) · 04/08 pre-linux (`nexora-dev-prelinux.sql` 29.257 B, en nube) · 16/08 pre-0009 (11 PASS) · 20/08 post-0009 (11 PASS) · 26/08 post-0010 (43K, 11 PASS) · **02/09: `nexora_dev_20260902_101800.sql` (48K) + roles (1,5K), headers verificados** · Bóveda offline: `~/Escritorio/Nexora/N. Respaldo/` (con `env-y-claves/` = caja fuerte) · regla: **un respaldo no existe hasta ver peso + primeras líneas + restore probado** (incidente del dump de 0 bytes, 04/08) |
| Seguridad de la cuenta | **Recovery codes de GitHub rotados el 03/09 (T0.0/N-17)** · regla: expuesto = rotado · el **botón prohibido**: "Reset to factory defaults" ☠️ (origen: el incendio 31/07, sobrevivido con volúmenes intactos) |

## 5.4 API

| Dato | Valor |
|---|---|
| Stack | Fastify 5 + Zod 4 (el orquestador conserva Zod 3, aislado — ADR-0007) · contenedor `nexora_api` · interno `0.0.0.0:3001` (override `HOST=0.0.0.0`) · local `127.0.0.1:3001` · detrás de Traefik HTTPS |
| Auth | JWT RS256 (claves montadas solo-lectura) · access 15 min · refresh 7 días en Redis · cookies HttpOnly+SameSite=Lax (`Secure` en prod) · rate limit login 10/min |
| Endpoints reales | `/health` · `/health/live` · `/health/ready` · `/login` · `/refresh` · `/logout` · `/me` · `/tenants/me` · `/onboarding/activate` (0010) |
| Planificados | PR-3 (solo lectura): `GET /platform/overview · health · services · clients · clients/:id · tenants · tenants/:id · users · onboarding · events · outbox · dlq · runtime/executions · runtime/projects` · PR-6: `POST /platform/clients · /platform/onboarding/:id/resend · /platform/events/:id/retry · /platform/events/:id/resolve` |
| Decisión cerrada (PR-2) | JWT = identidad (`userId`, `tenantId`); **permisos NO viajan en el JWT** — se resuelven por request (efecto inmediato); sin caché en V1 |
| Aislamiento probado | Login 200 · `/me` 200 · cruce Nexora→Acme = **404 (RLS)** · cadena: JWT → auth hook → tenant wrapper → misma conexión → `set_config('app.current_tenant_id')` → RLS · regreso sin contaminación del pool |
| Fronteras del panel | El navegador jamás toca PostgreSQL ni Docker · la API nunca usa `nexora_admin` como conexión normal · sin secretos ni tokens visibles · sin SQL libre · no se borran auditorías ni volúmenes desde V1 · **no existe botón "reset"** ☠️ |

## 5.5 Personas y roles

| Quién | Rol | Notas |
|---|---|---|
| **Lucho (fundador)** | Jefe; **no es programador** | Pega comandos PEGADOS, uno a la vez, validando cada paso · 4–6 h/día · necesita generar plata · cierra con memes ("estoy cansado jefeee") — respetar cuando corta |
| **Jules (agente)** | Constructor y auditor técnico | Revisa y propone; implementa y demuestra; **no decide alcance ni autoriza merge** |
| **Copiloto (Chat Arena)** | Revisor / auditor / archivero | Auditoría de planes, diseño de prueba de oro, forense de refs, mapas |
| **Codex (GitHub)** | Revisor automático | Convergencias: P2 del pulso (PR #4) y P1+P2 del ADR-0011 |
| **Empleado #0** | El vigía (dogfooding) | A0 médico (healthcheck) · A1.1 ojo de DLQ · A1.2 Encargado (busca/traeme/donde/clientes, Telegram) · A3 acciones supervisadas (enterrar/reintentar con si/no) · **A2 definido**: 5 ÉXITOS en racha → autónomo · 2 FRACASOS → revoca · tope 5/día · solo transitorias · aprende por runbooks (Qdrant), NO reentrenando modelos |

**Regla Madre:** *"acá nadie es mejor ni peor que nadie; un solo equipo."*

## 5.6 Comercial (contexto)

| Dato | Valor |
|---|---|
| Leads | **23 leads de Rosario** (0 contactados al 03/09 — acción T0.5) |
| Tarifa actual | Web única **USD 100–150 + 15/mes** · Bot (Spoki) **60–80 + 15–25/mes** · Combos · Empleado digital SaaS **150–300/mes** · Meta mes 4: **USD 800–1.200/mes** |
| Tarifa alternativa (ejercicio B, input para T0.4) | Setup **USD 150–500** + mensualidad **50–150** + piloto 30 días a precio cerrado · 3 paquetes: Recepción / Recepción+Seguimiento / Empleado Digital Comercial |
| Activos | Guiones · Spoki (secretaria/recepcionista) · kit de ventas · chat comercial separado · propuestas de webs/bots/combos · plan de seguridad de webs aprobado |
| Descubrimiento | 5–7 conversaciones o 2 semanas · ≥2–3 fríos · preguntas de hechos + *¿qué información nunca debe inventar un sistema? / ¿qué acciones necesitan aprobación humana?* · construir sobre *qué pasó / qué intentaste / qué te costó / qué aceptarías probar / qué aceptarías pagar*, nunca sobre "qué te gustaría" |
| El primer producto puede ser | Recepción · Filtro · Seguimiento · Agenda · Web · otra solución · **o ninguno** para ese segmento (resultado válido) · candidatos de los ejercicios: inmobiliarias (🥇 ambas), servicios, clínicas administrativas (solo recepción), estudios profesionales, comercios con mucho WhatsApp |
| A quién NO vender primero | Empresas grandes · bancos/hospitales/gobiernos · negocios sin volumen de consultas · clientes que quieren "una IA que haga todo sola" |

## 5.7 Decisiones de arquitectura y producto

| Tema | Decisión |
|---|---|
| ADRs | 0003 RLS multi-tenant · 0004 monorepo pnpm · 0005 multi-vertical · 0006 Traefik · 0007 límites apps/packages · 0008 permisos versionados · 0009 API `api_user` + frontera runtime · 0010 onboarding · **0011 Agent Runtime (ARCHIVADO)** |
| ADR-0011 en corto | 3 cerebros (`agent_executions` identidad · `operational_events` append-only · `agent_projects` contexto) · 6 tablas con RLS · Message Bus 7 tópicos idempotentes · Decision Score (impact ∈ [−3,+3]; escalamiento 0–2.5 autónomo / 2.6–5.0 supervisor / 5.1–7.5 humano / 7.6–10 admin-legal) · máquina de estados (REVIEW = READ-ONLY) · 9 métricas (`false_autonomy_rate` <5%, `unnecessary_escalation_rate` <10%) · **⚠️ 2 fixes obligatorios (N-01): P1 `app.current_tenant_id` · P2 `FORCE ROW LEVEL SECURITY`** |
| Nexora Control | `apps/control` (React·Vite·TS·Tailwind) · `apps/admin` = CLI de provisioning (no se convierte en panel) · `control.nexora.localhost` · V1 solo lectura · SSE = PR-5 · éxito = las 10 preguntas en <2 min |
| **PnA/PnB — Prototipos de Nexora Control (02/09)** | **PnA** (doc-web de especificación, 117K): **no entra como código**; se extraen la **matriz de fuentes por pantalla** y los **3 gates** → brief de PR-3 · **PnB** (SPA real con login/rutas/estados/demo): **semilla de PR-4** tras cerrar 6 objeciones (N-04) · fortalezas a conservar: supuestos `[S1]`–`[S5]` grepeables · `refreshInFlight` único · jerarquía de errores · `productManifest.ts` versionado ("cualquier cambio requiere PR") · demo solo con `VITE_DATA_MODE=demo` + banner + `demo: true` · ESLint prohíbe tokens en storage / `dangerouslySetInnerHTML` / SQL desde navegador |
| **WF-A/WF-B — Prototipos de Web Factory (20/08)** | **WF-A** (ejecutado en PG temporal: Next actualizado, 0 vulnerabilidades runtime, demo): landing genérica + imagen rota + agentes simulados → **descartado como producto**; se rescatan proyecto/pasos/SiteConfig/renderer/preview · **WF-B** (solo auditoría estática; nunca ejecutado): pipeline de textos fijos, no genera webs → se rescatan pipeline/eventos/auditorías/handoff como ideas · **ninguno entra al monorepo** |
| Web Factory (backlog) | Spec de 11 pasos + prueba de cierre (N-15) · estándar: Checklist Inteligente |
| Visión de marca (ejercicios) | No parecer empresa de robots/circuitos/cerebros · una **N abstracta modular** (puntos → conexión → decisión → acción) · family branding: NEXORA / NEXORA WEB / NEXORA AGENTS / NEXORA OPS · mensaje: **"Nexora — trabajo inteligente para empresas reales"** (B: colores azul noche `#0B1220`, cian `#22D3EE`, ámbar `#F59E0B`) |

## 5.8 Reglas no negociables (consolidadas y deduplicadas)

1. Un paso, una validación. No avanzar si la validación falla.
2. Cero suposiciones: verificar con evidencia antes de tocar.
3. Menos piezas, más evidencia. No construir sin caso de uso.
4. Cuarentena antes que DROP (neutralizar → observar → borrar al último).
5. Apps jamás como `postgres` · API jamás como `nexora_admin`.
6. Permisos versionados: grants/revokes nacen en migraciones, nunca a mano.
7. Secretos fuera de Git/chats/logs. **Expuesto = rotado.**
8. Migraciones = única fuente de evolución + prueba de oro (clon vacío + `migrate.mjs` = plataforma entera).
9. Backup verificado: peso + primeras líneas + restore probado; dump y roles juntos.
10. Commit + push + CI + documentación al cerrar cada bloque.
11. No push directo a `master`. Entregas por rama + PR con OK explícito del fundador.
12. **Un PR no existe hasta que `git ls-remote origin` muestra su ref.**
13. El fundador ejecuta comandos pegables, uno a la vez; cada bloque termina con `# FIN` dentro del bloque.
14. No borrar contenedores ni volúmenes por intuición. Un solo engine Docker, un solo protagonista por proceso.
15. Eliminaciones físicas prohibidas en Core (soft-delete `deleted_at`).
16. **El botón prohibido: "Reset to factory defaults" ☠️**
17. Pregunta filtro: *¿esto acerca a una empresa real a tener un empleado digital?* Si NO → se justifica o se posterga.
18. Todo dato público con fuente verificable; la plataforma debe poder explicar sus decisiones (*¿por qué Nexora hizo esto?*).
19. **Veredictos defendidos** (regla vinculante desde 29/07): toda decisión criticable se registra con QUÉ se decidió / POR QUÉ / QUÉ se descartó y por qué / CUÁNDO se revisita.
20. Antes de cualquier acción irreversible → advertencia explícita + confirmación (protección total de los datos de Nexora).

## 5.9 Protocolos de trabajo

**Con el fundador (protocolo sagrado):**
1. Un comando a la vez, listo para pegar, con el "esperado" debajo (método EXPLICAR → IMPLEMENTAR → VALIDAR → CONTINUAR: conducir, no esperar).
2. Todo bloque termina en `FIN` (marca anti-duende). (Evolución de protocolo: antes `; echo FIN` al final del comando — hoy `# FIN` dentro del bloque.)
3. El fundador no programa: nosotros escribimos; él valida y ejecuta.
4. **Duende**: carácter invisible al pegar ("no se encontró la orden") → tipear a mano o limpiar el inicio.
5. `Ctrl+C` no funciona en su terminal → `pkill -INT -f "src/index.ts"` (o `pnpm stop`); si no muere, `pkill -9`.
6. Nano no le responde → guardar JSON con Python, no con editor.
7. Archivos al chat como **`.txt`** (el chat rechaza `.ts`/`.md`); vía `~/para-chat/` + verificación **sha256** antes de copiar.
8. `--env-file=../../.env` en los arranques tsx (el código NO carga `.env` solo).
9. **Prohibido heredocs. Prohibidas comillas simples** dentro de strings bash (se rompen al pegar). SQL solo por archivos. Mensajes cortos (netbook chica, el chat se tilda). Con cada paso, advertir los 1–2 errores más probables y su antídoto.
10. Humor y Regla Madre.

**Rutas de la máquina (Linux Mint, netbook):**
- `~/dev/nexora-platform` — el repo · `.env` (gitignored, 600; NUNCA leer/pegar; contiene DATABASE_URL, DATABASE_ADMIN_URL, DATABASE_API_URL, ORCHESTRATOR_DATABASE_URL, ENCARGADO_DATABASE_URL, REDIS_*, MINIO_*, QDRANT_*, TELEGRAM_*)
- `~/para-chat/` (puente a chats) · `~/Descargas/` (archivos del workspace) · `~/cuarentena/` (reversible; nunca se borra directo)
- `~/Escritorio/Nexora/N. Respaldo/` — **bóveda offline** (dumps + roles + `env-y-claves/`) · copias de mapa en `~/Documentos/` (sincronizar con sha256)
- `infra/scripts/verificar-entrega.sh` v2: encuentra → sha256 → copia → re-verifica → limpia Descargas

**Con Jules (etapas obligatorias, ninguna se salta):**
`Tarea → Auditoría → Plan técnico → Criterios de terminado → Riesgos y preguntas → OK del fundador → Implementación → Tests → PR → Revisión humana → OK de merge → Merge → Documentación`
- El OK es explícito: *"OK para implementar el plan tal como está escrito."* (o *"OK con estas modificaciones: …"*)
- "Terminado" no existe porque compiló: se demuestran los criterios de aceptación (tests, prueba negativa, prueba de oro, CI, rollback, backup/restore).
- **Lecciones de la Fase 2 (02/09):** (1) un PR no existe sin ref remota · (2) confirmar que el árbol local está sobre la rama del PR antes de medir (una prueba de oro inicial midió `master` sin querer) · (3) archivos largos viajan como archivos o por git, nunca por portapapeles · (4) control negativo antes que positivo (el instrumento primero demuestra que mide ausencia) · (5) Codex habilitado como revisor automático.
- **Lecciones históricas que sostienen todo:** el fantasma de Postgres (un solo engine por máquina) · los bugs que solo una base vacía expone (la prueba de oro paga) · ping miente en WSL2 (testigo = TCP/DNI) · el literal statement-breakpoint en prosa · el dump de 0 bytes (verificar peso + primeras líneas).

## 5.10 Estándar de calidad del empleado web (Checklist Inteligente — resumen)

Documento de 30 secciones (identidad, conversión, estructura, home, confianza, FAQ, UX, responsive, hero, formularios, contacto, redes, SEO on-page, SEO local, performance, accesibilidad, seguridad, legal, e-commerce, contenido avanzado, idiomas, páginas especiales, compartir, opcionales, Manus.im, QA final, matriz de decisión, informe previo, regla final). Es el estándar **cuando** se construya el empleado de webs (backlog) o cualquier vertical web:
- **Antes de diseñar:** analizar negocio, objetivo, público, acción deseada, confianza, alcance geográfico, tipo de venta → determinar qué es obligatorio, recomendable y **lo que NO tiene sentido**.
- **Personalización:** NO web genérica con todos los componentes; cada elemento responde a una necesidad concreta.
- **Cero fabricación (prohibido inventar):** testimonios, reseñas, clientes, certificaciones, números, premios, perfiles. Si falta información → **solicitarla o eliminar el elemento**.
- **Matriz de decisión (antes de agregar cualquier componente):** ¿mejora Conversión / Confianza / UX / SEO / Accesibilidad / Performance / Comprensión / Funcionalidad? Varios → alta prioridad · ninguno → no agregarlo · perjudica → eliminarlo.
- **Informe previo obligatorio** (negocio, conversión, páginas, componentes, SEO, UX, performance, legal).
- **Manus.im / cualquier IA generadora:** definir la tarea antes; verificar resultado, código, diseño, responsive, SEO, accesibilidad, seguridad; corregir contenido inventado. **"La IA genera; el empleado verifica."**
- **Regla final:** el objetivo no es una web con MÁS cosas, es una web con EXACTAMENTE las cosas que ese negocio necesita. Y antes de entregar, el empleado debe poder explicar **por qué existe cada elemento importante y qué objetivo cumple**. Si no puede justificarlo, no debería estar ahí.

## 5.11 Glosario rápido

| Término | Significado |
|---|---|
| **Pulso** | Toma de presión del organismo: `outbox\|dlq\|triggers\|policies\|migraciones` = `3\|0\|6\|7\|12` |
| **Firma estructural** | Prueba de oro: `migraciones\|policies\|triggers` = `12\|7\|6` (orden distinto al pulso) |
| **DNI** | `system_identifier` del cluster Postgres: huella digital única del organismo |
| **Urna** | Base descartable para pruebas (se crea, se prueba, se elimina); nunca se toca la base viva con pruebas |
| **Prueba de oro** | Levantar la plataforma completa desde base vacía con `node migrate.mjs` y verificar la firma |
| **Puerta de salida** | Criterio DONE verificable sin el cual no se pasa de etapa ("evita construir sobre arena") |
| **Perfil de salud** | `base` (10/10) y `B1` (`NEXORA_PROFILE=b1`, 11/11 con API arriba) — siempre citar el perfil |
| **Duende** | Carácter invisible que aparece al pegar comandos en la terminal del fundador |
| **Fantasma** | (histórico) segundo engine Docker en WSL que secuestraba el 5432; encarcelado 29/07 |
| **Fósiles** | Objetos antiguos cuarentenados (`_fosil_*`, 9 objetos del 29/07) — DROP final pendiente de censo |
| **Museo 🏺** | Original: contenedores históricos (abuelo/viejo/rescue) que no se encienden ni se tocan · Hoy (0827): nombre del set oficial de 7 servicios vivos |
| **Wedge** | Traefik trancado tras reinicio sucio; cura: `docker start nexora_traefik` (4 veces probado) |
| **Cuarentena** | Neutralizar → observar → borrar al último (aplica a datos, archivos y memoria) |
| **Veredicto defendido** | Registro de toda decisión criticable: QUÉ / POR QUÉ / QUÉ se descartó / CUÁNDO se revisita |
| **Empleado digital** | Agente con identidad, permisos, objetivos, herramientas autorizadas, límites, trazabilidad y autonomía graduada (A0→A3) — no un chatbot |
| **Outbox / DLQ** | Cola transaccional de eventos / "cementerio" monitoreado de mensajes envenenados |
| **Botón de encendido único** | El compose raíz (`infra`) levanta y gobierna los 7 servicios (logro de D1) |

## 5.12 Insumos estratégicos — ejercicios "Si Nexora fuera tuyo" (09/2026)

Prompt fundador: *"si vos fueras yo y este proyecto es tuyo (yo no existiera): ¿qué saldrías a vender? ¿cómo lo venderías? ¿quiénes serían los clientes? ¿qué terminarías ahora? ¿producto estrella? ¿marketing? ¿cómo convencés de confiar? ¿logo?"* — respondido por varios modelos. **Atención (C-13): dos respuestas están en archivos byte-idénticos con labels "claude" y "chatgpt" (autoría ambigua — se llama "Respuesta A"); la tercera es la "Respuesta B (arena ia)".**

| Eje | Respuesta A (autoría ambigua) | Respuesta B (arena ia) |
|---|---|---|
| Producto de entrada | **Nexora Web** — "Tu negocio online, listo para trabajar por vos"; escalera: web → web+automatización → web+asistente → empleado digital | **Nexora Recepción y Seguimiento** — empleado de recepción/comercial agnóstico de canal (responde lo aprobado, califica, agenda/deriva, hace seguimiento, avisa cuando hay intención real, registra todo, nunca inventa) |
| Verticales | 🥇 Inmobiliarias · 🥈 Servicios (electricistas, construcción, profesionales) · 🥉 Gastronomía (después) | Inmobiliarias pequeñas · clínicas odontológicas/estética (solo recepción administrativa) · estudios profesionales · comercios con mucho WhatsApp |
| 0011 | No menciona tajada inicial | **Tajada vertical en semana 2** (executions + events append-only + decisions + provenance + escalamiento humano + estados básicos + auditoría) |
| Panel | "MVP mínimo; no perder semanas en gráficos bonitos" | "Lo dejaría para después" |
| Precio | — | Setup 150–500 + mensualidad 50–150 + piloto 30 días cerrado · 3 paquetes |
| Ventas | 30 negocios seleccionados (web vieja/lenta/sin WhatsApp) + auditoría simple + demo "así estás hoy vs así podrías estar" | 2–3 negocios de los 23 leads + diagnóstico + demo + piloto 30 días; guion y cierre documentados |
| Confianza | 5 cosas: resultado primero · transparencia · dominio del cliente · soporte humano · casos reales | 5 cosas: límites explícitos · fuentes aprobadas · revisión humana · registro consultable · **piloto reversible** |
| Marca | N abstracta modular · "Nexora — trabajo inteligente para empresas reales" | N de dos trayectorias/nodos (puente-nexo) · azul noche/cian/ámbar · "Empleados digitales que ejecutan trabajo real sin perder el control" |
| Visión | Familia NEXORA WEB/SALES/SUPPORT/OPS/INTELLIGENCE bajo un solo núcleo | Lo mismo: "Web Factory como puerta de entrada; el corazón = el empleado digital" |
| **Acuerdo de ambas + del plan** | No vender "IA/plataforma/agentes" → vender resultado concreto · cerrar primero Compose/docs/autorización/roles · **una** vertical con datos · venta directa a los 23 leads · primer cliente = confianza comercial · dominio del cliente · soporte humano · cero métricas inventadas · Web Factory = segunda línea | (idéntico) |

**Resolución:** las divergencias no se resuelven a priori — las arbitra el discovery (T0.5): producto de entrada y vertical (T3.1), precio (T0.4), scope del panel (T2.2: mínimo en todos los escenarios), tajada 0011 (T3.3: opción registrada).

---

# ANEXO A — Fuentes analizadas (28 documentos únicos + 5 re-adjuntos + estado 03/09)

| Documento | Fecha | Rol |
|---|---|---|
| `REPORTE-DIARIO-NEXORA-2026-09-02.md` | 02/09 | **Historia certificada más reciente** (PRs #3–#5, 0012, hallazgos, lecciones, cola) |
| `MAPA-GENERAL-NEXORA-v8-2026-09-02.md` | 02/09 | **Mapa más reciente** (histórico a partir de v9) |
| `AUDITORIA-PANELES-A-vs-B-2026-09-02.md` | 02/09 | **Decisión vigente** PnA→docs / PnB→semilla + 6 objeciones + 3 gates |
| `BRIEF-PR2-RBAC-NEXORA-CONTROL-2026-09-02.md` | 02/09 | **Brief vigente** de PR-2-RBAC (plan de trabajo aprobado) |
| `AUDITORIA-PLANES-MAESTROS-2026-09-03.md` | 03/09 | Auditoría independiente ejecutada y resuelta en este reporte (C1–C6, G1–G3, F1–F6) |
| `PLAN-NEXORA-CONTROL-Y-0011-2026-08-27.md` | 27/08 | Fuente de diseño del panel (pantallas, rutas, permisos, discovery) — absorbido en v9 |
| `PLAN-MAESTRO-NEXORA-2026-08-27.md` | 27/08 | **Base estructural de v9** (5 etapas + puertas + hitos H1–H10) |
| `PLAN-MAESTRO-NEXORA-COMPLETO.md` | 27/08 | Aportes: frente comercial + estimaciones + `/graduacion`; alcance extra → backlog |
| `PLAN-TRABAJO-NEXORA-CONSOLIDADO-2026-08-27.md` | 27/08 | Histórico (estado 27/08 superado) |
| `ADDENDUM-26-2026-08-27.md` | 27/08 | Histórico (API Docker, restore, prueba de oro 11 migraciones) |
| `MAPA-GENERAL-NEXORA-v7-2026-08-27.md` | 27/08 | Histórico |
| `MAPA-GENERAL-NEXORA.md` (v6) | 24/08 | Histórico (perfiles base/B1, cola 24/08) |
| `MAPA-GENERAL-NEXORA.md` (post-0009) | 20/08 | **Historial clave:** incidente de seed + cuarentena (N-18), `/activar` obligatoria (N-13), WF-A/WF-B auditados (N-14), perfiles de salud |
| `MAPA-GENERAL-NEXORA-pre-0009-2026-08-20.md` | 15/08 (nombre 08-20, C-12) | Histórico (B1, 9 migraciones, 6 contenedores) |
| `MAPA-GENERAL-NEXORA-2026-08-04-documentos.md` | 04/08 | Histórico (Día D; **contiene contraseña dev → anonimizar, N-10**) |
| `MAPA-GENERAL-NEXORA-2026-08-04-respaldo.md` | 04/08 | Histórico (copia de la anterior, header de Día D ejecutado) |
| `MAPA-GENERAL-NEXORA.pdf` | export 04/08 | **Obsoleto** (DNI viejo) — regenerar o retirar (C-14) |
| `PASAPORTE-TALLER-NEXORA.md` | 24/08 | Histórico (protocolo con el fundador + rutas; comandos obsoletos — reemplazados en §4.0) |
| `REPORTE-DIARIO-NEXORA-2026-08-15.md` | 15/08 | Histórico (B1: diseño de perfiles base/B1, commits, veredictos) |
| `PLAN-TRABAJO-NEXORA-POST-0009-2026-08-20.md` | 20/08 | Histórico (diseño 0010, `/activar`, Web Factory, orden ejecutivo) |
| `REPORTE-2026-07-23-nexora.md` | 23/07–04/08 | **Bitácora fundacional** (rescate SP2, fantasma, prueba de oro 6/6, fósiles, RAM, incendio, SP3, Día D — 9 addenda) |
| `PROMPT-COPLUTO-NEXORA.md` | 05/08 | **Vigente** (identidad de copiloto, método, disciplina de comandos, regla museo original) |
| `PROTOCOLO-DE-TRABAJO-CON-JULES-NEXORA.md` | vigente | **Vigente** (corrección de numeración C-08 pendiente en T0.3) |
| `ADR-0011-agent-runtime-specification.md` | 24/08 | **Referencia archivada** (no implementar; 2 fixes obligatorios N-01) |
| `Confirmacion_migracion.md` | era 0010 | Histórico (valores obsoletos — §3.5) |
| `Checklist Inteligente — Empleado Digital para Creación de Sitios Web.md` | v1 | **Referencia vigente** (estándar de calidad — §5.10) |
| `si nexora fuera tuyo (claude).html` = `(chatgpt).html` | 09/2026 | **Insumo estratégico — Respuesta A** (autoría ambigua, C-13) |
| `si vos fueras nexora (arena ia).html` | 09/2026 | **Insumo estratégico — Respuesta B** |
| `github-recovery-codes.txt` | 09/2026 | ☠️ **EXCLUIDO del consolidado por política de seguridad (N-17)** — códigos rotados el 03/09 |
| `cuarentena-outbox-25cc0597….json` | 20/08 | **Artefacto de cuarentena documentado** (incidente de seed 0009 — N-18) |
| Estado declarado por el fundador | 03/09 | **Más reciente:** D1 cerrado (7/7 en `infra`, H1, DNI íntegro, Qdrant `Aug 8 17:10`) · D2 abierto (`Perfil: base` → hipótesis B1 confirmada por evidencia, 1 comando para cerrar) |

*Documento único consolidado el 03/09/2026 a partir de 28 documentos + estado de máquina. Un solo equipo. 🧉*
