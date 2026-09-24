# Auditoría general de ECC (affaan-m/ECC)

**Fecha:** 2026-09-22 · **Pin:** `main` @ `bf70150eb2df8070024e5bdf08e4aa08959e2735` (2026-09-21)
**Método:** checkout del repo oficial completo + lectura de instaladores, hooks,
manifests, CI, guías de seguridad y código fuente. Sin ejecutar nada.

## 1. Identidad

| | |
|---|---|
| Proyecto | "Agent harness operating system" para agentes de código IA |
| Mantenedor | Affaan Mustafa (solo, releases semanales) + contribuyentes |
| Licencia | MIT (código); el repo incluye Apache-2.0 (InsAIts) y piezas propias |
| Versiones | `ecc@ecc` 2.2.2 (npm `ecc-universal`), último tag git `v2.2.1` |
| Adopción | ~265k estrellas, ~40k forks, 2.800+ commits, 53 ramas |
| Negocio | OSS gratis; **ECC Pro** = GitHub App hosted ($19/seat/mes, private repos); sponsors: Itô Markets (compute), CodeRabbit, Greptile, Kimi/Moonshot, SerpApi |

## 2. Qué hace, en una frase

ECC **instala una capa de configuración + contenido para agentes de código** en
7+ harnesses (Claude Code, Codex, Cursor, OpenCode, Gemini CLI, Zed, Kimi, Kiro,
CodeBuddy, Antigravity, Copilot). La capa tiene 5 componentes:

1. **292 skills** (`skills/`) — playbooks markdown por dominio/framework
2. **68 agentes** (`agents/`) — especialistas markdown (planner, architect,
   code-reviewer, security-reviewer, tdd-guide, build-error-resolvers por
   lenguaje, gan-generator/evaluator, chief-of-staff, etc.)
3. **94 comandos** (`commands/`) — slash commands (`/code-review`,
   `/build-fix`, `/epic-decompose`, `/cost-report`, …) + `legacy-command-shims/`
4. **Rules** (`rules/`) — 21 packs por lenguaje/framework + `common`
   (coding-style, patterns, testing, security, hooks, git)
5. **Hooks** (`hooks/` + `scripts/hooks/`) — **la única parte que se ejecuta**:
   47 scripts que se cuelgan en el lifecycle del agente (PreToolUse/PostToolUse/
   SessionStart/Stop/PreCompact)

Además: convenciones MCP, un sistema de instalación con perfiles, un CLI,
auditorías de plataforma, y R&D (Rust/Python) que todavía no se distribuye.

## 3. Arquitectura del repo (por carpeta)

| Carpeta | Qué es | Se ejecuta? |
|---|---|---|
| `skills/` (5.6 MB) | 292 playbooks markdown: framework por lenguaje (django/laravel/springboot/quarkus 4 skills c/u: patterns+security+tdd+verification), agent-* (harness construction, eval, introspection), orch-* (pipeline orquestado con gates humanos), homelab-*, healthcare-* (HIPAA/CDSS/EMR), ito-* (compute sponsor), scientific-*, taste-* (video/diseño), security-* | No (prompt) |
| `agents/` (568 KB) | 68 agentes especialistas en markdown | No (prompt) |
| `commands/` (560 KB) | 94 slash commands | No (prompt) |
| `rules/` (588 KB) | Packs por stack (typescript, react, vue, nuxt, go, rust, k8s…) | No (prompt) |
| `hooks/` | `hooks.json` (registro de hooks para Claude Code), `codex-hooks.json`, metadata, `memory-persistence` | **Sí** (registra) |
| `scripts/hooks/` (76 KB) | **Los 47 hooks** — ver §5 | **Sí** |
| `scripts/` (3.2 MB) | ~50 scripts Node: instalador (`install-apply.js`, `install-guided.js`, `install-plan.js`, `uninstall.js`, `repair.js`), CLI `ecc.js` (343 líneas: `control-pane`, `platform-audit`, `security-ioc-scan`, `auto-update`, `work-items`, `session-inspect`, `loop-status`), auditorías (`harness-audit.js`, `observability-readiness.js`), memory (`memory.js`, `memory-mcp.mjs`), orquestación (`orchestrate-worktrees.js` tmux/worktrees), `lib/` | **Sí** (si se usa) |
| `manifests/` | Sistema de instalación declarativo: `install-profiles.json` (minimal/core/developer/security/opencode…), `install-modules.json` (rules-core, agents-core, commands-core, hooks-runtime, platform-configs, workflow-quality, framework-language, database, orchestration), `install-components.json` | No (datos) |
| `schemas/` | 11 JSON Schemas (hooks, install-state, memory, plugin, capsule-envelope…) | No |
| `mcp-configs/` | 34 servidores MCP **recomendados** — ver §6 | No (config) |
| `.claude/` | Config del propio repo como usuario de ECC: `enterprise/controls.md`, `homunculus/instincts`, `research/`, `team/`, `workflows/` (workflow de roadmap de seguridad Pro) | No |
| `.codex/ .cursor/ .opencode/ .gemini/ .zed/ .kimi/ .kiro/ .codebuddy/ .hermes/ .adal/ .qwen/ .pi/ .openclaw/ .trae/ .agents/` | Adaptadores por harness (skills, rules, hooks, installers propios en algunos, ej. `.codebuddy/install.js`) | Mixto |
| `.claude-plugin/ .codex-plugin/ plugins/ecc/` | Definición de plugin `ecc@ecc` (marketplace.json, plugin.json, schema notes) | No |
| `ecc2/` (2 MB) | **ECC 2.0 en Rust**: `ecc-tui` — "Agentic IDE control plane with TUI dashboard". ratatui/crossterm, tokio, rusqlite, git2, ssh. Módulos: session, notifications, observability, comms, harness_eval. Alpha, no se publica como binario | R&D |
| `src/llm/` (Python) | Abstracción LLM provider-agnóstica (alpha): claude, openai, ollama, atlas, astraflow; CLI, tools, prompts | R&D |
| `integrations/aura/` | Adaptador de *trust-check* de contrapartes (agent-to-agent payments): solo 1 `GET /check?did=…`, stdlib puro, read-only, **off por defecto**, trae su propio `THREAT_MODEL.md` | Opt-in |
| `workflows/` | `orch-review.workflow.js`: review multi-agente por dimensiones (calidad + lenguaje + seguridad condicional) + **verificación adversarial** de cada finding CRITICAL/HIGH; falla cerrado ante input inválido | Sí (workflow de Claude Code) |
| `docker/plugin-setup/` | Entorno Docker para testear el instalador contra CLIs reales | Test |
| `tests/` (5.3 MB) | Validación CI: `check-unicode-safety` (inyección con unicode invisible), `validate-agents/commands/rules/skills/hooks`, `check-hooks-schema-keys`, `validate-install-manifests`, `validate-no-personal-paths` + suite con cobertura (c8, ≥80% líneas/funciiones) | Test |
| `.github/workflows/` | CI: matriz OS × Node × npm/pnpm/yarn/bun; empaquetado del instalador; lifecycle de install packed; **SLSA3 (OSS-Fuzz)**; `supply-chain-watch` + `scan-supply-chain-iocs` (IOC de supply chain); `release-approval-gate`; `monthly-metrics`; announces | CI |
| `docs/` (16 MB) | Docs en 13 idiomas, guías (shortform/longform/**security**), roadmap, design (memory vault), releases, troubleshooting | No |
| Raíz | `AGENTS.md`, `SOUL.md` (identidad/principios), `CLAUDE.md`, `the-security-guide.md` (guía de seguridad agéntica: prompt injection, MCP Top 10, CVE de Claude Code feb-2026, "lethal trifecta"), `SECURITY.md` (soporte 2.x, reporting privado), `COMMANDS-QUICK-REF.md`, `.gitleaksignore` | No |

## 4. Cómo funciona la instalación

- **Entradas:** `npx ecc-universal@2.2.2 setup` (asistente de Claude),
  `install --guided` (multi-harness: claude/codex/kimi), o `./install.sh`
  (wrapper de 34 líneas → hace `npm install --ignore-scripts` **bloqueando
  RCE por postinstall de deps comprometidas** → `node scripts/install-apply.js`).
- **6 binarios npm:** `ecc`, `ecc-control-pane`, `ecc-install`,
  `ecc-memory-mcp`, `ecc-plan-canvas`, `ecc-universal`.
- **Targets:** `claude` (global `~/.claude/`), `claude-project` (`./.claude/`),
  codex, cursor, opencode, gemini, zed, kimi, kiro, codebuddy, antigravity…
  Cada target recibe un adaptador distinto (no es copiar el repo completo).
- **Perfiles** (`manifests/install-profiles.json`): `minimal` (sin hooks),
  `core`, `developer` (default: +framework+database+orchestration), `security`,
  `opencode`… Composición por **módulos**; también `--skills <ids>` para
  instalar skills sueltas y `--dry-run`/`--json`.
- **Hooks opcionales desde el plugin:** `hooks_enabled: false` y
  `hook_profile: minimal|standard|strict`.

## 5. Hooks — la única parte que ejecuta (47 scripts)

Todos en `scripts/hooks/`, wireados vía `hooks/hooks.json` con un patrón
común: bootstrap (resuelve la raíz de ECC) → `run-with-flags.js <nombre>
<script> standard,strict` (gate por perfil) → el hook.

| Categoría | Hooks | Qué hacen |
|---|---|---|
| **Seguridad** | `gateguard-fact-force.js` (fork de zunoworks/gateguard), `gateguard-heredoc.js` | Bloquean Edit/Write/Bash hasta que el agente presenta hechos concretos (importadores, schemas) — "fact-forcing" |
| | `insaits-security-monitor.py` + wrapper (3er parte, Apache-2.0, Nomadu27/InsAIts) | Detección local de anomalías: exposición de credenciales, prompt injection, cadenas de alucinación, 20+ tipos. **Opt-in** (`ECC_ENABLE_INSAITS=1`, `pip install insa-its`). Exit 2 = bloquea la tool |
| | `config-protection.js`, `block-no-verify.js`, `pre-bash-dev-server-block.js` | Protegen config del proyecto; bloquean `git commit --no-verify`; evitan dev servers en producción |
| | `mcp-health-check.js` | Levanta localmente cada MCP server configurado para verificarlo (spawn del comando) |
| | `check-console-log.js`, `pretooluse-visible-output.js` | Hygiene de output |
| **Calidad** | `quality-gate.js`, `pre-bash-commit-quality.js`, `post-edit-format.js`, `post-edit-typecheck.js`, `stop-format-typecheck.js`, `design-quality-check.js` | Corretn prettier/eslint/tsc antes de commit o al editar |
| **Registro local** | `session-activity-tracker.js`, `post-bash-command-log.js`, `cost-tracker.js`, `skill-run-tracker.js`, `ecc-metrics-bridge.js` | Escriben logs **locales** (`~/.claude/metrics/tool-usage.jsonl`, `bash-commands.log`, `cost-tracker.log`) con **redacción de secrets** (AKIA/ASIA, ghp_/gho_, passwords, Authorization). "ECC2 metric sync" = futuro; hoy solo archivo local |
| **Governance/observación** | `governance-capture.js`, `observe-runner.js`, `evaluate-session.js`, `ecc-context-monitor.js`, `session-start-bootstrap.js`, `session-start.js`, `session-end.js`, `session-end-marker.js`, `pre-compact.js`, `suggest-compact.js`, `post-edit-accumulator.js` | Capturan estado de sesión para el control plane (ECC2), sugieren compaction |
| **QoL / dev** | `desktop-notify.js`, `auto-tmux-dev.js`, `ecc-statusline.js`, `pre-bash-tmux-reminder.js`, `pre-bash-git-push-reminder.js`, `post-bash-pr-created.js`, `post-bash-build-complete.js`, `doc-file-warning.js`, `pre-write-doc-warn.js`, `cursor-session-env.js`, `plan-canvas-sessions.js`, `plan-canvas-pending.js`, dispatchers (`pre-bash-dispatcher`, `post-bash-dispatcher`, `posttooluse-dispatcher`, `bash-hook-dispatcher`), `run-with-flags(.js/.sh)`, `check-hook-enabled.js`, `plugin-hook-bootstrap.js`, `lifecycle-hook-bootstrap.js` | Notificaciones, tmux, statusline, reminder de push/PR, warnings de docs, routing interno |

**Hallazgos de seguridad del chequeo de código:**

- ✅ **Sin `eval()` ni `new Function()`** en hooks.
- ✅ **Sin endpoints de red en los hooks** (las URLs encontradas son
  documentación/creditos). Los logs no salen de la máquina.
- ✅ Uso de `child_process` es el esperado (correr prettier/tsc/gates);
  `mcp-health-check` spawnea los comandos MCP que *el usuario* configuró.
- ✅ El instalador usa `npm install --ignore-scripts` (mitiga RCE de deps).
- ⚠️ **Superficie = 47 scripts de terceros** que se ejecutan en el entorno del
  agente con las mismas permisos. Código legible y coherente, pero no
  auditado por nosotros.
- ⚠️ **InsAIts es código de 3er parte** (se instala aparte por pip) aunque
  funcione 100% local y sea opt-in.
- ⚠️ Los 34 MCP recomendados (§6) amplían la superficie real: varios piden
  API keys (Firecrawl, GitHub PAT, Supabase, Jira…) y 1 es remote HTTP
  (Vercel).

## 6. Convenciones MCP (34 servidores recomendados)

No son obligatorios — es un catálogo con comandos y envs. Destacan: oficiales
(`memory`, `sequential-thinking`, `filesystem`), ops (`github`, `jira`,
`supabase`, `clickhouse`), web (`firecrawl`, `exa`, `context7`, `cloudflare`
×4, `vercel` remote-HTTP, `railway`), memoria rica (`omega-memory`, `longhand`,
`memxus`, `ecc-memory-vault` local), calidad (`codescene`, `magic`) y 2 ligados
al sponsor Itô (`nexus` proxy local de costo/privacidad, `ito-compute` —
paquete no publicado, hay que compilarlo de su repo).

## 7. R&D (no se distribuye, pero existe)

- **`ecc2/` (Rust):** control plane TUI "ECC 2.0" — dashboard del operador
  (sesiones, notificaciones, observabilidad, eval de harness). Alpha.
- **`src/llm/` (Python):** capa LLM provider-agnóstica (5 providers) con CLI y
  tools. Alpha.
- **`integrations/aura/`:** trust-check agent-to-agent (1 GET read-only).
- **`workflows/orch-review.workflow.js`:** el workflow más maduro: fan-out de
  reviewers por dimensión + refutación adversarial de findings, con human
  gates alrededor (fail-closed).

## 8. Postura de seguridad del propio proyecto

- `SECURITY.md`: versiones soportadas 2.x; reporting vía GitHub advisories o
  `affaan@ecc.tools`; nada en issues públicos.
- `the-security-guide.md`: guía extensa de seguridad agéntica (vectores de
  inyección, MCP Top 10 de OWASP, CVE-2025-59536/CVE-2026-21852 de Claude
  Code, "lethal trifecta" de Simon Willison).
- CI de seguridad propio: `supply-chain-watch.yml`,
  `scan-supply-chain-iocs.js` (IOC de supply chain), `check-unicode-safety`
  (unicode invisible en denials — el último commit del repo es un fix
  justamente de eso), `validate-no-personal-paths`, SLSA3.
- `.gitleaksignore` (detecta secrets en el repo).

## 9. Evaluación para Nexora Platform

| Aspecto | Veredicto |
|---|---|
| Contenido (skills/rules/agents) | Alto valor puntual; ya cherry-pickamos lo de seguridad a `dev-agent/` |
| Hooks | Bien diseñados y sin red, pero 47 scripts de terceros = ejecutar solo después de auditarlos uno a uno (o no) |
| MCP catalog | **Cuidado**: cada MCP que se habilita agrega superficie. Para Nexora, máx. `github` + memoria local, nada con API keys externas sin necesidad |
| e2e del sistema (ECC2, src/llm, aura) | Irrelevante para nuestro caso; es R&D del maintainer |
| Gobernanza del proyecto | Mantenedor solo con releases semanales, proceso de release con approval gate, CI serio. Riesgo de *bus factor* bajo-moderado; MIT lo mitiga |
| **Riesgo residual principal** | Un commit malicioso/comprometido del mantenedor afectaría a quien tenga auto-update o hooks activados → **siempre fijar versión y deshabilitar auto-update** |

**Recomendación (sin cambios vs. la anterior):** mantener el cherry-pick
(`dev-agent/`, solo markdown), no correr el instalador ni hooks, y re-evaluar
en el sub-proyecto 8 (Seguridad y ops) con el gateguard y el orch-review como
candidatos a auditar.
