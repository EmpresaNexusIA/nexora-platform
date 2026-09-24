# dev-agent/ — checklists y skills de seguridad para agentes de código

Cherry-pick **seleccionado y sin ejecutar** de [ECC (affaan-m/ECC)](https://github.com/affaan-m/ECC):
solo contenido de referencia (markdown) para seguridad. Nada de acá se ejecuta
de forma automática.

**Fuente y pin:** ECC `main` en commit `bf70150eb2df8070024e5bdf08e4aa08959e2735`
(2026-09-21). Licencia MIT — ver [`LICENSE-ECC`](LICENSE-ECC). Solo volver a
clonar desde el repo oficial (nunca de forks/mirrors): ver
[`docs/tooling/ecc-agent-harness.md`](../docs/tooling/ecc-agent-harness.md).

## Qué contiene

| Archivo | Qué es | Cuándo usarlo en Nexora |
|---|---|---|
| `skills/security-review/SKILL.md` | Workflow completo de review de seguridad (checklist por capa: auth, input, secrets, deps, runtime) | Antes de liberar cualquier app (`apps/*`) y en el sub-proyecto 8 |
| `skills/security-review/cloud-infrastructure-security.md` | Extensión de la review para infra cloud/contenedores | Sub-proyectos 1 y 8 (Docker, Traefik, red) |
| `skills/gateguard/SKILL.md` | Técnica "fact-forcing": obligar al agente a investigar (importadores, schemas) antes de editar | Método manual reutilizable; su hook JS **no** fue copiado |
| `skills/security-scan/SKILL.md` | Auditoría de la propia config de agente (CLAUDE.md, hooks, MCP) por inyección/malconfig | Cuando se toque `CLAUDE.md` o se agregue cualquier hook/MCP |
| `skills/production-audit/SKILL.md` | Checklist de pre-lanzamiento a producción (auth, workers, logs, errores) | Antes de cada pase a producción |
| `rules/common-security.md` | Reglas de seguridad genéricas (secrets, validación, respuesta a incidentes) | Checklist base antes de commit |
| `rules/typescript-security.md` | Reglas específicas TS/JS (el stack de `apps/*` y `packages/*`) | Código TS/JS |
| `rules/web-security.md` | Reglas web (XSS, headers, CSP) | `apps/web`, `apps/admin`, `apps/tienda` |

Los archivos `rules/*` conservan el frontmatter `paths:` original (escopo del
harness de origen); acá funcionan como documentación de referencia.

## Cómo usarlo

1. **Como checklist para humanos/agentes:** abrir el SKILL.md correspondiente y
   ejecutar su checklist punto por punto (o pedírselo a un agente de código
   como parte del prompt de review).
2. **No** registrar nada de acá como hook, MCP o comando automático.
3. Para reviews grandes, pedir al agente que use `security-review` + la rule
   del stack relevante (TS para backend, web para frontend).

## Qué se excluyó a propósito

- **Hooks ejecutables** (p. ej. `scripts/hooks/gateguard-fact-force.js`):
  código de terceros que se ejecutaría en el entorno de desarrollo. No se
  auditaron; si algún día se quieren habilitar, auditar el script contra el
  pin y luego decidir.
- Skills de otros frameworks (Django, Laravel, Spring, etc.), tests, assets y
  el resto del repo (~60 MB): no aplican a este stack.

## Actualización

Para actualizar: clonar ECC de nuevo (repo oficial), fijar el nuevo commit
aquí y abajo en `docs/tooling/ecc-agent-harness.md`, diffear los 8 archivos
contra la versión anterior y revisar el delta antes de reemplazarlos.
