#!/usr/bin/env bash
# ============================================================
# 🔄 restore-test.sh — Prueba de restore en urna desechable
#
# Restaura un dump sin tocar la base viva y compara estructura,
# datos y permisos clave contra el organismo actual.
#
# USO:
#   bash infra/scripts/restore-test.sh <dump.sql>
#
# Sin argumento usa el dump nexora_dev_*.sql más reciente de la bóveda.
# Un dump histórico puede ser restaurable pero fallará la comparación
# contra el organismo actual: en ese caso se debe indicar/documentar
# explícitamente que es histórico, no declararlo backup vigente.
# ============================================================

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️${NC} $1"; }

CONTAINER="nexora-postgres"
DB_USER="nexora_admin"
ADMIN_USER="postgres"
LIVE_DB="nexora_dev"
TEST_DB="nexora_restore_test"
BOVEDA="${HOME}/Escritorio/Nexora/N. Respaldo"
RESTORE_LOG=""
URNA_CREADA=0

cleanup() {
  local original_status=$?
  if [ "${URNA_CREADA}" -eq 1 ]; then
    echo ""
    echo "🧹 Limpiando urna..."
    if docker exec "${CONTAINER}" psql -X -U "${ADMIN_USER}" -d postgres \
      -c "DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE);" >/dev/null 2>&1; then
      ok "Urna ${TEST_DB} eliminada — base viva intacta"
    else
      fail "No se pudo eliminar la urna ${TEST_DB}; requiere revisión manual"
      original_status=1
    fi
  fi
  if [ -n "${RESTORE_LOG}" ]; then
    rm -f "${RESTORE_LOG}"
  fi
  trap - EXIT
  exit "${original_status}"
}
trap cleanup EXIT

if [ $# -ge 1 ]; then
  DUMP_FILE="$1"
else
  DUMP_FILE=$(ls -t "${BOVEDA}"/nexora_dev_*.sql 2>/dev/null | head -1 || true)
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

if ! docker ps --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
  fail "El contenedor ${CONTAINER} no está corriendo."
  exit 1
fi
ok "Contenedor vivo"

live_query() {
  docker exec "${CONTAINER}" psql -X -U "${DB_USER}" -d "${LIVE_DB}" \
    -t -A -v ON_ERROR_STOP=1 -c "$1"
}

# Foto esperada tomada de la base viva, nunca de números hardcodeados.
EXPECTED_MIGRATIONS=$(live_query "SELECT count(*) FROM drizzle.__drizzle_migrations;")
EXPECTED_POLICIES=$(live_query "SELECT count(*) FROM pg_policies;")
EXPECTED_RLS=$(live_query "SELECT count(*) FROM pg_class WHERE relname IN ('users','tenants') AND relnamespace='public'::regnamespace AND relrowsecurity=true AND relforcerowsecurity=true;")
EXPECTED_OUTBOX=$(live_query "SELECT count(*) FROM audit.outbox;")
EXPECTED_GRANT_USERS=$(live_query "SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='api_user' AND table_schema='public' AND table_name='users';")
EXPECTED_GRANT_RBAC=$(live_query "SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='api_user' AND table_schema='public' AND table_name IN ('roles','permissions','roles_to_permissions');")
EXPECTED_GRANT_CLIENTES=$(live_query "SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='api_user' AND table_schema='public' AND table_name='clientes';")
EXPECTED_RBAC_PK=$(live_query "SELECT count(*) FROM pg_constraint WHERE conrelid='public.roles_to_permissions'::regclass AND contype='p';")

printf '\n🔄 restore-test.sh — Prueba de restore en urna\n'
printf '%s\n' '------------------------------------------------------------'
printf '  Dump:  %s\n' "${DUMP_FILE##*/}"
printf '  Urna:  %s (desechable)\n' "${TEST_DB}"
printf '  Base de comparación: %s viva\n\n' "${LIVE_DB}"

# La urna es explícitamente desechable; WITH (FORCE) evita residuos de una
# ejecución interrumpida anterior.
echo "Preparando urna..."
docker exec "${CONTAINER}" psql -X -U "${ADMIN_USER}" -d postgres \
  -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE);" >/dev/null

docker exec "${CONTAINER}" psql -X -U "${ADMIN_USER}" -d postgres \
  -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${TEST_DB};" >/dev/null
URNA_CREADA=1
ok "Urna ${TEST_DB} creada (limpia)"

RESTORE_LOG=$(mktemp)
echo "Restaurando dump en la urna..."
if ! docker exec -i "${CONTAINER}" psql -X -U "${DB_USER}" -d "${TEST_DB}" \
  -v ON_ERROR_STOP=1 -q < "${DUMP_FILE}" >"${RESTORE_LOG}" 2>&1; then
  fail "El restore devolvió error; no se declara éxito"
  echo "----- últimas líneas del log -----"
  tail -30 "${RESTORE_LOG}"
  exit 1
fi
ok "Dump restaurado sin errores SQL"

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

test_query() {
  docker exec "${CONTAINER}" psql -X -U "${DB_USER}" -d "${TEST_DB}" \
    -t -A -v ON_ERROR_STOP=1 -c "$1"
}

echo "------------------------------------------------------------"
echo "Verificando restauración contra la base viva..."
echo ""

MIG=$(test_query "SELECT count(*) FROM drizzle.__drizzle_migrations;")
check "Migraciones" "${MIG}" "${EXPECTED_MIGRATIONS}"

POL=$(test_query "SELECT count(*) FROM pg_policies;")
check "Policies RLS" "${POL}" "${EXPECTED_POLICIES}"

TENANTS=$(test_query "SELECT count(*) FROM information_schema.tables WHERE table_name='tenants' AND table_schema='public';")
check "Tabla tenants" "${TENANTS}" "1"

USERS=$(test_query "SELECT count(*) FROM information_schema.tables WHERE table_name='users' AND table_schema='public';")
check "Tabla users" "${USERS}" "1"

CLIENTES=$(test_query "SELECT count(*) FROM information_schema.tables WHERE table_name='clientes' AND table_schema='public';")
check "Tabla clientes" "${CLIENTES}" "1"

RLS=$(test_query "SELECT count(*) FROM pg_class WHERE relname IN ('users','tenants') AND relnamespace='public'::regnamespace AND relrowsecurity=true AND relforcerowsecurity=true;")
check "RLS ENABLE+FORCE (users+tenants)" "${RLS}" "${EXPECTED_RLS}"

OUTBOX=$(test_query "SELECT count(*) FROM audit.outbox;")
check "Outbox (datos)" "${OUTBOX}" "${EXPECTED_OUTBOX}"

GRANT_USERS=$(test_query "SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='api_user' AND table_schema='public' AND table_name='users';")
check "Grants api_user→users" "${GRANT_USERS}" "${EXPECTED_GRANT_USERS}"

GRANT_RBAC=$(test_query "SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='api_user' AND table_schema='public' AND table_name IN ('roles','permissions','roles_to_permissions');")
check "Grants directos api_user→RBAC" "${GRANT_RBAC}" "${EXPECTED_GRANT_RBAC}"

GRANT_CLIENTES=$(test_query "SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='api_user' AND table_schema='public' AND table_name='clientes';")
check "Grants directos api_user→clientes" "${GRANT_CLIENTES}" "${EXPECTED_GRANT_CLIENTES}"

RBAC_PK=$(test_query "SELECT count(*) FROM pg_constraint WHERE conrelid='public.roles_to_permissions'::regclass AND contype='p';")
check "PK roles_to_permissions" "${RBAC_PK}" "${EXPECTED_RBAC_PK}"

echo ""
echo "------------------------------------------------------------"
echo "RESULTADO: ${PASS} PASS · ${FAIL} FAIL"
if [ "${FAIL}" -eq 0 ]; then
  ok "🎉 RESTORE VERIFICADO — coincide con el organismo vivo"
  echo "   El dump restaura sin errores y conserva estructura, datos y ACL clave."
  exit 0
else
  fail "⚠️ HAY DIFERENCIAS — el dump no representa el organismo vivo actual"
  exit 1
fi
