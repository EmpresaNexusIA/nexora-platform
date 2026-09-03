cat << 'EOF' > docs/PLAN-MAESTRO-NEXORA-v9.md
# 🏛️ PLAN MAESTRO NEXORA — VERSIÓN 9 (v9)
**Operaciones y Estrategia · 03/09/2026 · Rosario, Santa Fe, Argentina 🇦🇷**
**Autoridad:** Único plan vigente. Reemplaza y unifica los planes anteriores.

---

# 1. DEFINICIÓN DEL PROYECTO
Nexora Platform es una plataforma SaaS self-hosted y multi-tenant que vende empleados digitales a pymes: agentes de IA que trabajan (atienden, organizan, responden, procesan) con identidad, permisos, herramientas autorizadas, límites, trazabilidad completa y autonomía graduada (A0→A3) bajo supervisión humana.

# 2. MAPA GENERAL DE TRABAJO (ROADMAP)
- **Fase 0 (Inmediato):** Fundación, cierre D1/D2, PLAN v9 + MAPA v9, Economía unitaria, 5 discoveries comerciales, rotación de claves (T0.0).
- **Fase 1 (Seguridad real):** PR-2 RBAC (0013) + Roles runtime 2.2 (Puerta G2).
- **Fase 2 (Visibilidad):** Nexora Control (PR-3 API /platform, PR-4 apps/control V1, PR-5 SSE, PR-6 acciones).
- **Fase 3 (Producto):** Selección de 1 vertical + Mínimo empleado operativo.
- **Fase 4 (Lanzamiento):** Página /activar, Observabilidad, Contratos legales, VPS con HTTPS, Backup VPS, Piloto 30 días, PRIMER CLIENTE PAGO por 0010 (TERMINADO 🎯).

# 3. AUDITORÍA DE CONTRADICCIONES Y ERRORES
- Jerarquía viva: v9 único.
- Resoluciones C-01 a C-14 aplicadas.
- Incidente N-17 de seguridad resuelto (T0.0).

# 4. REPOSITORIO DE INFORMACIÓN LIMPIA
- DNI: `7670634338808201248`
- Pulso sagrado: `3|0|6|7|12` (`outbox|dlq|triggers|policies|migraciones`)
- Firma estructural: `12|7|6`
- Salud: Base 10/10 | B1 11/11 (`NEXORA_PROFILE=b1`)
- Servicios: 7/7 en `infra`
EOF

cat << 'EOF' > docs/MAPA-GENERAL-NEXORA-v9.md
# 🗺️ MAPA GENERAL NEXORA — VERSIÓN 9 (v9)
**Estado al 03/09/2026 · Rosario, Santa Fe, Argentina 🇦🇷**

## Estado de la Máquina y Organismo
- **DNI:** `7670634338808201248` (Íntegro)
- **Pulso sagrado:** `3|0|6|7|12` (`outbox|dlq|triggers|policies|migraciones`)
- **Firma estructural:** `12|7|6`
- **Salud oficial:** Perfil B1 `11/11` (`NEXORA_PROFILE=b1`)
- **Servicios:** 7/7 bajo proyecto `infra`

## Puertas de Salida
- **G1 (Compose normalizado):** ✅ CERRADA (D1)
- **G2 (Roles runtime 2.2):** ❌ ABIERTA (Fase 1)
- **G3 (Salud B1 11/11):** ✅ CERRADA (D2)

## Próximos pasos
1. Completar T0.4 (Economía Unitaria) y T0.5 (Discovery).
2. Avanzar a Fase 1: PR-2 RBAC (migración 0013).
EOF

git add docs/
git commit -m "docs: registrar evidencia D1 y volcar PLAN v9 y MAPA v9"
git checkout master
git merge docs/v9-plan-and-d1-evidence
# FIN
