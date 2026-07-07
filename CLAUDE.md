# Nexora Platform — instrucciones para Claude Code

## Entorno de ejecución

Todo comando (`docker`, `pnpm`, `git`, scripts) se ejecuta dentro de la distro
WSL `Ubuntu-22.04` (usuario `nexora`), nunca directo en PowerShell/Git Bash.
Desde una sesión de Claude Code en Windows, invocar así:

```bash
wsl.exe -d Ubuntu-22.04 -- bash -lc 'cd /home/nexora/nexora-platform && <comando>'
```

El repo vive en el filesystem nativo de WSL (`/home/nexora/nexora-platform`),
no en `C:\` — `pnpm install` falla de forma reproducible (`EPERM: operation
not permitted, futime`) contra rutas Windows-montadas (`/mnt/c/...`), una
incompatibilidad conocida de WSL2/DrvFs. Desde Windows, el mismo repo se ve en
`\\wsl.localhost\Ubuntu-22.04\home\nexora\nexora-platform`.

## Convenciones del repo

- Monorepo pnpm workspaces (`apps/*`, `shared/*`), paquetes `@nexora/*`.
- Compose modular: un `compose.yaml` por servicio bajo `infra/`, combinados
  desde `infra/compose.yaml` vía `include:`. No crear un compose monolítico.
- Traefik es el único reverse proxy — nuevos servicios se exponen agregando
  labels `traefik.*`, no tocando config central.
- Decisiones de arquitectura que costaría revertir van en
  `docs/architecture/decisions/NNNN-titulo.md` (plantilla en `0000-template.md`).
  No todo cambio necesita un ADR — solo decisiones estructurales.
- Secrets reales van en `secrets/*.env` (gitignored). Las plantillas versionadas
  van en `env/*.env.example`. Nunca commitear un valor real.
- Tests unitarios junto al código (`apps/api/src/**/*.test.ts`). `tests/` en la
  raíz es solo para integración/e2e/carga entre servicios.

## Sub-proyectos

Este repo se construye en 9 sub-proyectos independientes (infra base → capa de
datos → n8n → mensajería → IA → apps → scraping/testing → seguridad/ops →
documentación). El orden y el porqué de cada uno está en
`docs/superpowers/specs/2026-07-07-infra-base-design.md`.
