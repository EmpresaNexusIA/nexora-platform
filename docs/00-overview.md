# Nexora Platform — overview

Nexora-IA es una plataforma de "empleados digitales" con IA. Hoy corre como un
bot (Telegram/WhatsApp) + panel sobre un VPS de Hostinger, usando Supabase.
Ese stack sigue en producción y no se toca desde este repo.

`Nexora Platform` es el diseño de la próxima versión: self-hosted, pensada
desde el día uno para atender cualquier tipo de cliente (comercios,
distribuidoras, talleres, profesionales, industrias, entidades públicas), no
solo negocios de servicios.

## Documentos clave

- **Spec de infra base:**
  [`docs/superpowers/specs/2026-07-07-infra-base-design.md`](superpowers/specs/2026-07-07-infra-base-design.md) —
  diseño completo de este primer sub-proyecto.
- **ADRs:** [`docs/architecture/decisions/`](architecture/decisions/) — una
  decisión estructural por archivo, numeradas.
- **Servicios:** [`docs/services/`](services/) — un documento por servicio
  operativo, agregado a medida que cada sub-proyecto lo construye.
- **Runbooks:** [`docs/runbooks/`](runbooks/) — procedimientos operativos
  (backup/restore, rotación de secrets, etc.), agregados desde el sub-proyecto
  8 (Seguridad y operaciones) en adelante.

## Orden de sub-proyectos

1. Infra base (este) — Docker Compose, red, Traefik, secrets, scripts, monorepo, CI, ADRs.
2. Capa de datos — PostgreSQL multi-tenant, Redis, Qdrant, MinIO.
3. Motor de automatización — n8n.
4. Mensajería — Evolution API (WhatsApp), integración Telegram.
5. Capa de IA — prompts, knowledge, memoria, embeddings, `apps/agents`.
6. Aplicaciones — `apps/api`, `apps/admin`, `apps/web`.
7. Scraping/testing — Playwright, Firecrawl, tests de integración/e2e/carga.
8. Seguridad y operaciones — backups, monitoreo, logs, rotación de secrets.
9. Documentación — se escribe por capa, no como proyecto aparte.
