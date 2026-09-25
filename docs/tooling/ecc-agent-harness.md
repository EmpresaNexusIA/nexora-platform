# ECC (affaan-m/ECC) — agent harness, referencia

> **Auditoría completa:** [`ecc-full-audit-2026-09-22.md`](ecc-full-audit-2026-09-22.md) —
> qué hace cada parte del repo, cómo instala, hooks, MCP, R&D y riesgos.

**Fecha de evaluación:** 2026-09-22
**Estado:** Referencia + **cherry-pick parcial** — skills/rules de seguridad en
[`dev-agent/`](../../dev-agent/README.md) (solo markdown, sin hooks); el resto
del repo no se integra (ver [Decisión](#decision))
**Fuente oficial:** <https://github.com/affaan-m/ECC> (instalaciones solo desde
canales oficiales, ver [Notas de seguridad](#notas-de-seguridad))

## Qué es

ECC es un "operating system de agent harness": un conjunto de **skills, agentes,
rules, hooks y workflows reutilizables para agentes de código IA**. No es un
servicio de runtime ni una librería de aplicación — es **tooling de desarrollo**:
se instala en el repo (o en la máquina del desarrollador) para que los agentes
que trabajan sobre el código traigan workflows probados (TDD, code review,
security review, gateguard anti-prompt-injection, memoria, research-first, etc.).

Hechos a la fecha de esta evaluación (verificados contra el checkout de `main`):

| Dato | Valor |
|---|---|
| Licencia | MIT (Copyright 2026 Affaan Mustafa) |
| Versión | `ecc@ecc` 2.2.2 en main; último tag git público `v2.2.1` |
| Contenido | 68 agentes, 292 skills, 94 command shims, hooks, rules, convenciones MCP |
| Tamaño del repo | ~60 MB (assets 23 MB, docs 16 MB, skills 5.6 MB, tests 5.3 MB, scripts 3.2 MB) |
| Adopción | ~265k estrellas, ~40k forks, 2.800+ commits, releases semanales |
| Canales oficiales | Repo GitHub, npm `ecc-universal` y `ecc-agentshield`, GitHub App `ecc-tools`, plugin `ecc@ecc`, sitio ecc.tools |
| Modelos de negocio | OSS gratis "para siempre"; ECC Pro es el GitHub App hosted (private repos desde $19/seat/mes) |
| Idioma de docs | README en 13 idiomas, incluido español (`docs/es/README.md`) |

Harnesses soportados (directorio de config o adaptador por harness): Claude Code
(`.claude/`), Codex (`.codex/`), Cursor (`.cursor/`), OpenCode, Gemini CLI, Zed,
Kimi, Kiro, CodeBuddy (Tencent), Antigravity y Copilot (`.github/prompts/` +
`copilot-instructions.md`).

## Qué aporta y qué no

**Aporta (solo al workflow de desarrollo, no a la plataforma):**

- Skills puntuales que encajan con los sub-proyectos de Nexora (p. ej.
  `security-review`, TDD, code review, ADR, infra/automation audit).
- Hooks de lifecycle/quality/safety con perfiles `minimal | standard | strict`.
- Un gateguard orientado a sanitizar prompt-injection (unicode invisible, etc.).

**No aporta / no aplica a Nexora Platform:**

- Nada de runtime: no es un servicio que se suba a Docker/Traefik, no tiene
  relación con la infra del sub-proyecto 1 ni con los servicios de `apps/`.
- Se superpone con `CLAUDE.md` del repo, que ya define el workflow de agente
  (WSL, convenciones de compose modular, ADRs, sub-proyectos). Si se instala en
  scope de proyecto, sus `AGENTS.md`/rules coexisten con ese archivo y hay que
  revisar conflicto de instrucciones.
- 292 skills es mucho contexto: instalado en full, la mayoría no se usa y
  infla el contexto de cada sesión de agente.

## Notas de seguridad

- Los **hooks ejecutan código de terceros** en el entorno del agente. Si algún
  día se integra, hacerlo con `hooks_enabled: false` (o revisando cada hook
  antes) y habilitar perfiles solo con hooks auditados.
- El propio README advierte que **solo se debe instalar desde canales
  oficiales** (repo GitHub, npm, GitHub App, plugin `ecc@ecc`, ecc.tools):
  re-uploads y mirrors no oficiales no están mantenido ni auditado y podrían
  contener malware. No clonar/copiar desde forks ni mirrors.
- Versiones: fijar siempre la versión (`npx ecc-universal@<ver>` con pin, o tag
  git) — un pin de versión no es auditoría de integridad; revisar el release
  antes de ejecutar el instalador.

## Cómo integrarlo en el futuro (de menor a mayor invasividad)

1. **Git submodule** (alternativa si la adopción crece):
   `git submodule add https://github.com/affaan-m/ECC.git tools/ecc` fijado a un
   tag (p. ej. `v2.2.1`). No ejecuta nada, es reversible, no infla el repo
   (gitlink) y se actualiza con `git submodule update --remote`. Tiene sentido
   si el cherry-pick actual se vuelve insuficiente.
2. **Cherry-pick** ✅ (ejecutado el 2026-09-22, pin
   `bf70150eb2df8070024e5bdf08e4aa08959e2735`): skills y rules de seguridad
   copiadas a [`dev-agent/`](../../dev-agent/README.md) (68 KB, solo
   markdown, sin hooks). Es el punto de partida si la adopción crece.
3. **Instalador oficial en scope de proyecto**:
   `npx ecc-universal@<ver> install --guided --harness claude` (escribe
   `.claude/`, `AGENTS.md`, skills en la raíz). Cambia el workflow real de
   desarrollo y superpone `CLAUDE.md`; usar con hooks deshabilitados y
   perfiles mínimos.
4. **Scope de usuario/máquina** (no toca el repo): instalar en la máquina WSL
   del desarrollador con `npx ecc-universal@<ver> setup` eligiendo scope
   *Global user*. Afecta a todos los proyectos de esa máquina.

## Decisión

**No se integra el repo completo** (2026-09-22): ECC es tooling de desarrollo
opcional, no infraestructura, y el repo ya tiene su capa de agente
(`CLAUDE.md`).

**Cherry-pick parcial ejecutado** (2026-09-22): solo skills/rules de seguridad,
en markdown y sin hooks, en [`dev-agent/`](../../dev-agent/README.md) (pin
`bf70150eb2df8070024e5bdf08e4aa08959e2735`). Se usará en las reviews de
seguridad y queda como base para el sub-proyecto 8 (Seguridad y operaciones),
donde también se re-evaluará el gateguard (auditar primero su hook JS).
