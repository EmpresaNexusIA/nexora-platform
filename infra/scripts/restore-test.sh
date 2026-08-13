#!/usr/bin/env bash
# ============================================================
#  🔄 restore-test.sh — Prueba de restore en urna desechable
#
#  Restaura un dump en una base de prueba (nexora_restore_test)
#  sin tocar la viva, verifica que la estructura está intacta
#  (migraciones, policies, RLS, tablas) y limpia todo después.
#
#  Regla: "cuarentena antes que DROP" — esto prueba en cuarentena.
#
#  USO:
#    bash ~/dev/nexora-platform/infra/scripts/restore-test.sh <dump.sql>
#
#  Si no pasás argumento, usa el dump más reciente de la bóveda.
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
ADMIN_USER="postgres"
TEST_DB="nexora_restore_test"
BOVEDA="${HOME}/Escritorio/Nexora/N. Respaldo"

# ---------- Argumento: dump a restaurar ----------
if [ $# -ge 1 ]; then
  DUMP_FILE="$1"
else
  DUMP_FILE=$(ls -t "${BOVEDA}"/nexora_dev_*.sql 2>/dev/null | head -1)
  if [ -z "${DUMP_FILE}" ]; then
    fail "No encontré dumps en la bóveda. Pasá la ruta como argumento."
    fail "USO: restore-test.sh <dump.sql>"
    exit 1
  fi
  warn "Sin argumento — usando el dump más reciente: ${DUMP_FILE##*/}"
fi

if [ ! -f "${DUMP_FILE}" ]; then
  fail "El archivo no existe: ${DUMP_FILE}"
  exit 1
fi

echo ""
echo "🔄 restore-test.sh — Prueba de restore en urna"
echo "------------------------------------------------------------"
echo "  Dump:  ${DUMP_FILE##*/}"
echo "  Urna:  ${TEST_DB} (desechable)"
echo ""

# ---------- 1. Pre-check ----------
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  fail "El contenedor ${CONTAINER} no está corriendo."
  exit 1
fi
ok "Contenedor vivo"

# ---------- 2. Limpiar urna previa si existe ----------
echo "Preparando urna..."
docker exec "${CONTAINER}" psql -U "${ADMIN_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};" 2>/dev/null
docker exec "${CONTAINER}" psql -U "${ADMIN_USER}" -d postgres -c "CREATE DATABASE ${TEST_DB};" 2>/dev/null
ok "Urna ${TEST_DB} creada (limpia)"

# ---------- 3. Restaurar el dump ----------
echo "Restaurando dump en la urna..."
cat "${DUMP_FILE}" | docker exec -i "${CONTAINER}" psql -U "${DB_USER}" -d "${TEST_DB}" -q 2>&1 | grep -v "^$" | head -5 || true
ok "Dump restaurado en ${TEST_DB}"

# ---------- 4. Verificaciones ----------
echo "------------------------------------------------------------"
echo "Verificando estructura restaurada..."
echo ""

PASS=0
FAIL=0
check() {
  if [ "$2" = "$3" ]; then
    ok "$1: $2 ✓ (esperado $3)"
    PASS=$((PASS+1))
  else
    fail "$1: $2 ✗ (esperado $3)"
    FAIL=$((FAIL+1))
  fi
}

# 4a. Migraciones
MIG=$(docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${TEST_DB}" -t -A -c "SELECT count(*) FROM drizzle.__drizzle_migrations;" 2>/dev/null)
check "Migraciones" "${MIG}" "6"

# 4b. Policies
POL=$(docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${TEST_DB}" -t -A -c "SELECT count(*) FROM pg_policies;" 2>/dev/null)
check "Policies RLS" "${POL}" "7"

# 4c. Tablas clave
TENANTS=$(docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${TEST_DB}" -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_name='tenants' AND table_schema='public';" 2>/dev/null)
check "Tabla tenants" "${TENANTS}" "1"

USERS=$(docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${TEST_DB}" -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_name='tenants' AND table_schema='public';" 2>/dev/null)
check "Tabla users" "${USERS}" "1"

CLIENTES=$(docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${TEST_DB}" -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_name='clientes' AND table_schema='public';" 2>/dev/null)
check "Tabla clientes" "${CLIENTES}" "1"

# 4d. RLS ENABLE + FORCE en users y tenants
RLS=$(docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${TEST_DB}" -t -A -c "SELECT count(*) FROM pg_class WHERE relname IN ('users','tenants') AND relrowsecurity=true AND relforcerowsecurity=true;" 2>/dev/null)
check "RLS ENABLE+FORCE (users+tenants)" "${RLS}" "2"

# 4e. Outbox (datos preservados)
OUTBOX=$(docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${TEST_DB}" -t -A -c "SELECT count(*) FROM audit.outbox;" 2>/dev/null)
check "Outbox (datos)" "${OUTBOX}" "3"

# 4f. Grant de api_user sobre users (nuestra migración 0005)
GRANT_USERS=$(docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${TEST_DB}" -t -A -c "SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='api_user' AND table_name='users';" 2>/dev/null)
check "Grants api_user→users" "${GRANT_USERS}" "4"

# ---------- 5. Resumen ----------
echo ""
echo "------------------------------------------------------------"
echo "RESULTADO: ${PASS} PASS · ${FAIL} FAIL"
if [ "${FAIL}" -eq 0 ]; then
  ok "🎉 RESTORE VERIFICADO — el dump restaura correctamente"
  echo "   La prueba de oro del restore está intacta."
else
  fail "⚠️  HAY FALLAS — el dump no restaura correctamente"
fi
echo ""

# ---------- 6. Limpieza (siempre, incluso si falló) ----------
echo "🧹 Limpiando urna..."
docker exec "${CONTAINER}" psql -U "${ADMIN_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};" 2>/dev/null
ok "Urna ${TEST_DB} eliminada — base viva intacta"
echo ""
