# PLAN COMPLETO DE NEXORA CONTROL Y ADR-0011

**Fecha de corte:** 27/08/2026  
**Propósito:** documento operativo para el fundador y fuente de contexto para futuros chats técnicos.  
**Estado:** aprobado como plan de trabajo; todavía no implementar cambios nuevos sin seguir las fases.

---

# 1. VISIÓN

Nexora es una plataforma SaaS self-hosted y multi-tenant para crear y operar empleados digitales que ejecutan tareas reales para pymes.

Principios:

- Potente por dentro, simple por fuera.
- Ejecución real, no solamente conversación.
- RLS y aislamiento desde el núcleo.
- Autonomía graduada y supervisada.
- Todo dato importante debe poder explicarse.
- Pregunta filtro: **¿esto acerca a una empresa real a tener un empleado digital?**

---

# 2. ESTADO TÉCNICO CERTIFICADO

## Git

- Repositorio: `EmpresaNexusIA/nexora-platform`.
- `master`: `50bc33d`.
- PR #2 mergeado.
- Rama Docker: `feat/infra-api-docker-20260827`.
- CI del PR: `lint` y `validate-compose` verdes.
- Árbol local sincronizado y limpio al cierre.

## Base

- Migraciones: 11 (`0000` a `0010`).
- Pulso operativo: `3|0|6|7|11`.
- Orden del pulso operativo: `outbox|dlq|triggers|policies|migraciones`.
- DNI: `7670634338808201248`.
- Policies: 7.
- Triggers: 6.

## Salud

- Healthcheck B1: `11/11`.
- 7 contenedores exactos.
- API Docker: `healthy`.
- API directa: HTTP 200.
- API vía Traefik HTTPS: HTTP 200.
- Dashboard Traefik sin credenciales: HTTP 401.

## Servicios

1. `nexora-postgres`
2. `nexora_traefik`
3. `nexora_whoami`
4. `nexora-redis`
5. `nexora-minio`
6. `nexora-qdrant`
7. `nexora_api`

## Onboarding 0010

Cerrado y certificado:

- staging end-to-end;
- provisioning;
- token de un solo uso;
- consumo atómico Redis Lua;
- anti-reuso;
- login;
- rollback;
- backup post-0010;
- restore: `11 PASS · 0 FAIL`;
- prueba de oro desde base vacía.

La prueba de oro devolvió `11|7|6`, cuyo orden es:

```text
migraciones|policies|triggers
```

No debe confundirse con el pulso operativo `3|0|6|7|11`.

## ACL de activación

La función `complete_client_activation()` quedó con:

```text
nexora_admin:EXECUTE, api_user:EXECUTE
```

No tiene `PUBLIC:EXECUTE`.

---

# 3. DIAGNÓSTICO DE AUTORIZACIÓN ACTUAL

## Lo que existe

La API actual:

- verifica JWT;
- obtiene `userId`;
- obtiene `tenantId`;
- aplica contexto de tenant;
- tiene RLS;
- tiene roles y permisos básicos.

Los permisos actuales son:

```text
users:read
users:write
tenant:settings
```

## Lo que falta

Todavía no existe:

- API de fundador;
- aplicación visual de control;
- permisos de plataforma;
- autorización por permiso en las rutas;
- lectura global controlada;
- endpoints `/platform/*`;
- tiempo real por SSE/WebSocket;
- integración visual con eventos, clientes, infraestructura y runtime.

## Usuarios observados

Existe un usuario destinado aparentemente a plataforma:

```text
admin@nexora.local
```

Está asociado al tenant especial:

```text
00000000-0000-7000-8000-000000000001
```

pero no tiene rol asignado. Esto debe formalizarse mediante migración, nunca con un `UPDATE` manual improvisado.

`admin@nexora.app` tiene rol Administrador, pero pertenece a otro tenant y no debe considerarse automáticamente fundador.

## Riesgo actual

El JWT exige `tenantId`, mientras que el fundador necesita alcance de plataforma. Además, `roles.tenant_id` puede ser NULL pero `users.tenant_id` es obligatorio.

Antes del panel hay que definir formalmente la identidad de plataforma. Recomendación inicial: usar un tenant especial de plataforma, formalizarlo y asignarle un rol global de fundador con permisos explícitos.

---

# 4. OBJETIVO: NEXORA CONTROL

Nexora Control será un panel privado del fundador.

No es el panel del cliente. No es la web comercial. No es el Web Builder.

Su función es permitir ver:

- qué existe;
- qué funciona;
- qué está en construcción;
- qué falló;
- qué clientes existen;
- qué tenants existen;
- qué está pasando en tiempo real;
- qué puede hacer el fundador;
- qué partes del 0011 están implementadas.

## Primera pantalla

Debe mostrar:

```text
Salud general: 11/11
Contenedores: 7/7
API: healthy
PostgreSQL: healthy
Redis: healthy
Traefik: healthy
MinIO: healthy
Qdrant: healthy
```

También:

- último backup;
- errores críticos;
- DLQ;
- outbox;
- eventos recientes;
- clientes por estado;
- tareas pendientes;
- bloques funcionando, en construcción y pendientes.

---

# 5. APLICACIÓN DEL PANEL

Crear una aplicación separada:

```text
apps/control/
```

`apps/admin` queda como herramienta CLI de provisioning. No se convierte en el panel visual.

## Pantallas V1

### Inicio

Estado general, salud, pulso, contenedores, alertas y actividad.

### Mapa del organismo

Relación entre Traefik, API, PostgreSQL, Redis, MinIO, Qdrant, orquestador y empleados.

### Producto

Separar:

```text
FUNCIONA
EN CONSTRUCCIÓN
PENDIENTE
ARCHIVADO
```

### Clientes

- leads;
- contacto;
- rubro;
- estado comercial;
- producto contratado;
- tenant;
- onboarding;
- última actividad;
- próxima acción.

### Crear cliente

Flujo visual:

```text
Datos comerciales
→ producto contratado
→ cliente CRM
→ tenant
→ usuario
→ invitación
→ configuración
→ revisión
```

### Onboarding

Línea de tiempo con estados y errores claros.

### Infraestructura

- contenedores;
- imágenes;
- redes;
- volúmenes;
- healthchecks;
- reinicios;
- uptime;
- logs resumidos;
- recursos.

### Actividad y auditoría

- actor;
- evento;
- tenant;
- fecha;
- resultado;
- severidad;
- versión;
- reintentos.

### Runtime 0011

Cuando exista:

- ejecuciones;
- proyectos;
- decisiones;
- escalaciones;
- rework;
- autonomía;
- herramientas;
- provenance.

---

# 6. TIEMPO REAL

La arquitectura será:

```text
Servicios Nexora
      ↓
API de plataforma
      ↓
SSE/WebSocket o polling controlado
      ↓
Nexora Control
```

## Eventos inmediatos

- caída de contenedor;
- error de API;
- activación;
- escalación;
- cambio de estado;
- nueva ejecución;
- evento de outbox;
- entrada en DLQ.

## Datos periódicos

- memoria;
- disco;
- uptime;
- conexiones PostgreSQL;
- uso de Redis;
- backups.

El panel debe mostrar siempre:

```text
Actualizado hace X segundos
```

o:

```text
Sin conexión en tiempo real
Último dato: hace X minutos
```

Primera opción recomendada: SSE por ser más simple que WebSocket para eventos servidor → panel.

---

# 7. SEGURIDAD DEL PANEL

## Permisos iniciales

```text
platform:control:read
platform:control:manage
platform:onboarding
platform:runtime:read
platform:runtime:manage
platform:backup:read
platform:events:read
```

Separar lectura de modificación.

## Rutas previstas

```text
GET  /platform/overview
GET  /platform/health
GET  /platform/services
GET  /platform/clients
GET  /platform/clients/:id
GET  /platform/tenants
GET  /platform/tenants/:id
GET  /platform/users
GET  /platform/onboarding
GET  /platform/events
GET  /platform/outbox
GET  /platform/dlq
GET  /platform/runtime/executions
GET  /platform/runtime/projects
```

Acciones futuras y angostas:

```text
POST /platform/clients
POST /platform/onboarding/:id/resend
POST /platform/events/:id/retry
POST /platform/events/:id/resolve
```

## Fronteras obligatorias

- el navegador nunca accede directamente a PostgreSQL;
- el navegador nunca accede directamente al socket Docker;
- la API nunca usa `nexora_admin` como conexión normal;
- no se muestra ningún secreto;
- no se muestra ningún token;
- no se permite SQL libre;
- no se borran auditorías;
- no se borran volúmenes desde V1;
- no existe botón “reset”.

Cada acción sensible debe seguir:

```text
explicación
→ confirmación
→ ejecución
→ auditoría
→ resultado
```

---

# 8. ORDEN DE IMPLEMENTACIÓN

## Fase 0 — Punto de control

- backup;
- healthcheck 11/11;
- árbol limpio;
- rama nueva;
- verificación de `master`;
- no tocar producción durante el diseño.

## Fase 1 — Documentación

Consolidar en el repo:

- MAPA v7;
- Addendum 26;
- ADD 23;
- ADD 24;
- reporte integral;
- `STAGING-0010.md`;
- `RUNBOOK-ACTIVACION.md`;
- `OPENAPI-ONBOARDING.yaml`;
- ADR-0011;
- este plan.

Todo por PR y CI.

## Fase 2 — Identidad de plataforma

- formalizar tenant de plataforma;
- formalizar usuario fundador;
- crear rol de fundador;
- crear permisos `platform:*`;
- asignar permisos mediante migración;
- evitar email hardcodeado;
- validar JWT y alcance.

## Fase 3 — Autorización backend

- middleware `requirePlatformPermission`;
- rutas `/platform/*`;
- funciones SQL angostas o vistas controladas;
- seguridad `SECURITY DEFINER` donde corresponda;
- `search_path` fijo;
- pruebas de acceso autorizado y denegado.

## Fase 4 — Nexora Control V1

- crear `apps/control`;
- login del fundador;
- Inicio;
- servicios;
- clientes;
- onboarding;
- actividad;
- errores;
- estado del producto.

## Fase 5 — Tiempo real

- definir eventos;
- agregar SSE;
- reconexión;
- indicador de última actualización;
- fallback a polling;
- pruebas de caída y recuperación.

## Fase 6 — Operación de clientes

- crear cliente desde panel;
- provisioning controlado;
- invitación;
- onboarding;
- configuración del negocio;
- auditoría.

## Fase 7 — ADR-0011 por tajadas

### 0011-A

- `agent_executions`;
- `agent_projects`;
- tenant isolation;
- estados;
- prueba de oro.

### 0011-B

- `operational_events`;
- `agent_decisions`;
- append-only;
- idempotencia;
- provenance.

### 0011-C

- `rework_cycles`;
- `escalation_logs`;
- escalamiento;
- resolución;
- auditoría.

### Runtime

- máquina de estados;
- Decision Engine;
- Message Bus con Redis inicialmente;
- Service Registry cuando exista necesidad real;
- conexión con Nexora Control.

## Fase 8 — Web Factory

Después de que exista runtime real:

- primer vertical;
- componentes;
- generación de webs;
- revisión;
- accesibilidad;
- Lighthouse;
- export estático;
- dominio del cliente;
- HTTPS;
- handoff;
- mantenimiento.

## Fase 9 — Piloto y venta

- seleccionar caso real;
- usar un cliente piloto;
- medir consultas, seguimiento y resultados;
- corregir el runtime;
- cobrar el primer cliente;
- convertir el caso en referencia.

---

# 9. DISCOVERY COMERCIAL EN PARALELO

Mientras se ordena el panel, hacer 5 conversaciones reales.

Reglas:

- 5 a 7 conversaciones o 2 semanas;
- al menos 2 o 3 contactos fríos;
- preguntas sobre hechos pasados;
- preguntar qué intentaron;
- observar el canal real;
- pedir frases textuales;
- medir compromiso;
- no vender una solución predeterminada.

Se debe descubrir si el primer producto es:

- Recepción;
- Filtro;
- Seguimiento;
- agenda;
- otra solución;
- o ningún producto para ese segmento.

No construir sobre “qué te gustaría”. Construir sobre:

```text
qué pasó
qué intentaste
qué te costó
qué aceptarías probar
qué aceptarías pagar
```

---

# 10. REGLAS OPERATIVAS

- Un comando por vez.
- Los bloques Bash terminan con `# FIN` dentro del bloque.
- Cero suposiciones.
- Validar antes de avanzar.
- No push directo a `master`.
- Cambios importantes por rama y PR.
- Secretos fuera de Git, chat y logs.
- No mostrar `.env`.
- No usar `drizzle-kit migrate`.
- Runner: `node migrate.mjs`.
- Apps nunca como `postgres`.
- API nunca como `nexora_admin`.
- Backup con dump y roles.
- Restore probado.
- Cuarentena antes que DROP.
- No borrar volúmenes por intuición.
- Un solo engine Docker.
- Un solo protagonista por proceso.
- No implementar ADR-0011 entero de una vez.
- No construir interfaces que prometan funciones aún inexistentes.
- No usar métricas, testimonios ni clientes inventados.
- La plataforma debe poder explicar sus decisiones.

---

# 11. DEFINICIÓN DE ÉXITO

Nexora Control V1 está terminado cuando Lucho pueda entrar y responder en menos de dos minutos:

1. ¿Nexora está viva?
2. ¿Qué servicios están funcionando?
3. ¿Qué falló?
4. ¿Qué clientes tengo?
5. ¿En qué estado está cada cliente?
6. ¿Qué onboarding está pendiente?
7. ¿Qué se está construyendo?
8. ¿Qué parte del 0011 está implementada?
9. ¿Qué pasó recientemente?
10. ¿Cuál es el próximo paso?

La primera versión no debe hacer todo. Debe hacer visible todo lo importante.

---

# RESUMEN EJECUTIVO

Nexora ya tiene la base técnica certificada. El siguiente paso es construir una consola privada del fundador, segura y visual, que transforme la plataforma de un conjunto de carpetas, servicios y comandos en un organismo que pueda observarse y operarse.

El orden correcto es:

```text
punto de control
→ documentación
→ identidad del fundador
→ permisos de plataforma
→ API /platform/*
→ Nexora Control V1
→ tiempo real
→ operación de clientes
→ ADR-0011 por tajadas
→ Web Factory
→ piloto
→ primer cliente pago
```

La prioridad es ver y entender Nexora sin inventar complejidad. El panel debe crecer junto con el organismo y convertirse en la herramienta central para administrar, observar, demostrar y vender Nexora.
