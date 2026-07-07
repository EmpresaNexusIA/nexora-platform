# Nexora Platform

Infraestructura self-hosted de Nexora-IA — pensada para reemplazar eventualmente
el stack actual (Supabase + VPS único) y para atender cualquier tipo de cliente
(comercios, distribuidoras, talleres, profesionales, industrias, entidades
públicas), no solo negocios de servicios.

No toca el bot en producción (`Nexora - Bot`). Se construye en paralelo, por
sub-proyectos independientes. Ver el diseño completo en
[`docs/superpowers/specs/2026-07-07-infra-base-design.md`](docs/superpowers/specs/2026-07-07-infra-base-design.md)
y las decisiones de arquitectura en [`docs/architecture/decisions/`](docs/architecture/decisions/).

## Requisitos

- Windows 11 con WSL2 y la distro `Ubuntu-22.04` (`wsl --install -d Ubuntu-22.04`).
- Docker Desktop con integración WSL activa para `Ubuntu-22.04`
  (Settings → Resources → WSL Integration).
- Todo el trabajo de este repo se hace parado en esa shell de Ubuntu, no en
  PowerShell/Git Bash directamente — ver `CLAUDE.md`.

## Quickstart

```bash
# Desde una shell de Ubuntu-22.04 (WSL), parado en la raíz del repo:
pnpm install
./scripts/up.sh
```

Levanta la red `nexora_net`, Traefik y el contenedor canario `whoami`.
Verificar en `https://whoami.nexora.localhost` (certificado local confiable
vía mkcert, ver `docs/architecture/decisions/0002-traefik-como-reverse-proxy.md`).

## Estructura

Ver el árbol completo y la explicación de cada carpeta en
`docs/superpowers/specs/2026-07-07-infra-base-design.md` (sección
"Estructura de carpetas").
