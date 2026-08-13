#!/usr/bin/env bash
# ============================================================
#  💾 backup.sh — Respaldo de base + roles (unidad operativa)
#
#  Regla de la casa: "respaldo = dump + roles siempre juntos"
#  + "Backups verificados (peso + primeras líneas)"
#
#  Qué hace:
#   1. Dump de nexora_dev (esquema + datos + RLS + policies + grants)
#   2. Dump de roles (pg_dumpall --roles-only, necesita postgres)
#   3. Verifica: archivo existe, peso > mínimo, primeras líneas OK
#   4. Guarda todo en la bóveda con timestamp
#
#  USO:
#    bash ~/dev/nexora-platform/infra/scripts/backup.sh
# ============================================================

set -euo pipefail

# ---------- Colores ----------
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️${NC} $1"; }

# ---------- Config ----------
CONTAINER="nexora-postgres"
DB_USER="nexora_admin"
DB_NAME="nexora_dev"
ROLES_USER="postgres"
BOVEDA="${HOME}/Escritorio/Nexora/N. Respaldo"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

DUMP_DB="${BOVEDA}/nexora_dev_${TIMESTAMP}.sql"
DUMP_ROLES="${BOVEDA}/nexora_roles_${TIMESTAMP}.sql"
PESO_MINIMO=1000  # bytes — un dump vacío o roto pesa menos

echo ""
echo "💾 backup.sh — Respaldo de base + roles"
echo "------------------------------------------------------------"

# ---------- 1. Pre-checks ----------
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  fail "El contenedor ${CONTAINER} no está corriendo."
  fail "Arrancalo con: docker start ${CONTAINER}"
  exit 1
fi
ok "Contenedor ${CONTAINER} vivo"

if [ ! -d "${BOVEDA}" ]; then
  fail "La bóveda no existe: ${BOVEDA}"
  fail "Creala con: mkdir -p '${BOVEDA}'"
  exit 1
fi
ok "Bóveda encontrada: ${BOVEDA}"

# ---------- 2. Dump de la base ----------
echo "Dumping base ${DB_NAME}..."
docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner > "${DUMP_DB}" 2>/dev/null

if [ ! -s "${DUMP_DB}" ]; then
  fail "El dump de la base está vacío — algo salió mal"
  rm -f "${DUMP_DB}"
  exit 1
fi

PESO_DB=$(stat -c%s "${DUMP_DB}")
ok "Base dumpeada: ${DUMP_DB##*/} ($(numfmt --to=iec ${PESO_DB}))"

# ---------- 3. Dump de roles ----------
echo "Dumping roles..."
docker exec "${CONTAINER}" pg_dumpall -U "${ROLES_USER}" --roles-only > "${DUMP_ROLES}" 2>/dev/null

if [ ! -s "${DUMP_ROLES}" ]; then
  fail "El dump de roles está vacío — algo salió mal"
  rm -f "${DUMP_ROLES}" "${DUMP_DB}"
  exit 1
fi

PESO_ROLES=$(stat -c%s "${DUMP_ROLES}")
ok "Roles dumpeados: ${DUMP_ROLES##*/} ($(numfmt --to=iec ${PESO_ROLES}))"

# ---------- 4. Verificación (peso + primeras líneas) ----------
echo "------------------------------------------------------------"
echo "Verificando dumps..."

# Base: peso + primeras líneas
if [ "${PESO_DB}" -lt "${PESO_MINIMO}" ]; then
  fail "Dump de base demasiado chico (${PESO_DB} bytes < ${PESO_MINIMO})"
  exit 1
fi
if head -5 "${DUMP_DB}" | grep -q "PostgreSQL database dump"; then
  ok "Base: header pg_dump encontrado ✓"
else
  fail "Base: no se encontró el header 'PostgreSQL database dump' en las primeras 5 líneas"
  head -3 "${DUMP_DB}"
  exit 1
fi

# Roles: peso + primeras líneas
if [ "${PESO_ROLES}" -lt "${PESO_MINIMO}" ]; then
  fail "Dump de roles demasiado chico (${PESO_ROLES} bytes)"
  exit 1
fi
if head -5 "${DUMP_ROLES}" | grep -q "PostgreSQL database cluster dump"; then
  ok "Roles: header pg_dumpall encontrado ✓"
else
  fail "Roles: no se encontró el header en las primeras 5 líneas"
  head -3 "${DUMP_ROLES}"
  exit 1
fi

# ---------- 5. Reporte final ----------
echo "------------------------------------------------------------"
ok "Backup completado y verificado ✓"
echo ""
echo "  Base:  ${DUMP_DB##*/} ($(numfmt --to=iec ${PESO_DB}))"
echo "  Roles: ${DUMP_ROLES##*/} ($(numfmt --to=iec ${PESO_ROLES}))"
echo ""
echo "  Para probar el restore:"
echo "    bash ~/dev/nexora-platform/infra/scripts/restore-test.sh '${DUMP_DB}'"
echo ""
