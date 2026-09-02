# PROTOCOLO DE TRABAJO CON JULES — NEXORA

**Regla principal:** Jules no empieza a programar por una orden ambigua. Primero revisa, entiende, propone y espera el OK explícito del fundador.

---

## 1. Etapas obligatorias

```text
Tarea
→ Auditoría
→ Plan técnico
→ Criterios de terminado
→ Riesgos y preguntas
→ OK del fundador
→ Implementación
→ Tests y validaciones
→ PR
→ Revisión humana
→ OK de merge
→ Merge
→ Documentación
```

Ninguna etapa puede saltearse.

---

## 2. Qué se le entrega a Jules

Cada tarea debe tener:

- objetivo de negocio;
- problema que resuelve;
- contexto técnico;
- archivos y módulos relevantes;
- qué está fuera de alcance;
- restricciones de seguridad;
- reglas de Git;
- evidencia disponible;
- criterios de terminado.

No se le debe pedir simplemente: “hacé el panel” o “implementá el 0011”.

---

## 3. Primera respuesta obligatoria de Jules

Antes de escribir código, Jules debe entregar:

### Diagnóstico

- qué encontró;
- qué existe;
- qué falta;
- qué contradicciones encontró;
- qué riesgos ve;
- qué supuestos no están demostrados.

### Plan

- pasos de implementación;
- archivos que modificaría;
- migraciones necesarias;
- endpoints necesarios;
- cambios de frontend;
- estrategia de seguridad;
- estrategia de pruebas;
- estrategia de rollback;
- documentación que actualizaría.

### Criterios de terminado

Debe explicar cómo se sabrá que la tarea está realmente terminada.

Ejemplos:

- tests verdes;
- prueba negativa de autorización;
- prueba de oro;
- CI verde;
- árbol limpio;
- endpoint documentado;
- healthcheck correcto;
- evidencia visual;
- backup y restore si corresponde.

### Preguntas abiertas

Jules debe detenerse y preguntar cuando falte una decisión del fundador. No debe rellenar huecos con suposiciones.

---

## 4. El OK del fundador

El fundador revisa:

- si el alcance es correcto;
- si el plan se entiende;
- si el orden es correcto;
- si los riesgos están controlados;
- si la tarea acerca a Nexora a un producto real;
- si el criterio de terminado es verificable.

El OK debe ser explícito:

```text
OK para implementar el plan tal como está escrito.
```

Si hay cambios:

```text
OK con estas modificaciones: ...
```

Sin ese OK, Jules solo puede investigar y documentar.

---

## 5. Reglas durante la implementación

Jules debe:

- trabajar en una rama propia;
- no hacer push directo a `master`;
- no hacer merge;
- no tocar secretos;
- no imprimir `.env`;
- no usar credenciales de producción;
- usar migraciones como única fuente de evolución de la base;
- hacer cambios pequeños;
- mantener compatibilidad con lo existente;
- ejecutar tests relevantes;
- informar cualquier desviación del plan.

Jules no puede decir “terminado” solo porque compiló. Debe demostrar los criterios de aceptación.

---

## 6. Entrega de Jules

Toda entrega debe informar:

- rama;
- commits;
- archivos modificados;
- archivos nuevos;
- tests ejecutados;
- resultados;
- validaciones manuales;
- riesgos pendientes;
- documentación actualizada;
- PR creado;
- qué debe revisar el fundador.

---

## 7. Revisión antes del merge

El fundador y el copiloto revisan:

- diff completo;
- archivos cambiados;
- permisos;
- RLS;
- exposición de secretos;
- tests positivos;
- tests negativos;
- CI;
- impacto en la base;
- rollback;
- documentación.

Si algo no se entiende, no se mergea.

---

## 8. Reglas especiales para Nexora Control

Nexora Control debe construirse por PRs pequeños:

### PR 1 — Auditoría y diseño

Sin código o con documentación solamente.

### PR 2 — Identidad del fundador y permisos de plataforma

Migración reproducible, autorización y tests.

### PR 3 — API de plataforma de solo lectura

`/platform/overview`, salud, servicios, clientes, tenants y eventos.

### PR 4 — Frontend Nexora Control V1

Inicio, servicios, clientes, onboarding y actividad.

### PR 5 — Tiempo real

SSE, reconexión y última actualización.

### PR 6 — Acciones administrativas controladas

Crear cliente, provisioning, reenvío de invitación y acciones auditadas.

### PR 7 — Integración progresiva con ADR-0011

Ejecuciones, eventos, proyectos, decisiones, escalaciones y rework.

---

## 9. Prompt base para Jules

```text
Antes de modificar código, auditá el repositorio y entregá:

1. diagnóstico del estado actual;
2. archivos y módulos involucrados;
3. contradicciones y riesgos;
4. plan paso a paso;
5. arquitectura propuesta;
6. migraciones necesarias;
7. endpoints y permisos;
8. pruebas positivas y negativas;
9. rollback;
10. criterios verificables de terminado;
11. preguntas que requieren decisión del fundador.

No implementes, no hagas commits, no hagas push ni merge hasta recibir OK explícito.
No leas ni imprimas secretos.
No uses api_user como administrador global.
No uses nexora_admin desde el frontend.
No expongas PostgreSQL ni Docker socket al navegador.
```

---

## 10. Regla final

Jules es un constructor y auditor técnico. No es quien decide el alcance del producto ni quien autoriza el merge.

```text
Jules revisa y propone.
El fundador entiende y autoriza.
Jules implementa y demuestra.
El equipo revisa.
El fundador aprueba el merge.
```

Esta disciplina evita acumular código, mezclar ramas, crear permisos inseguros y construir funcionalidades antes de saber para qué sirven.
