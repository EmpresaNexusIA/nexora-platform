#!/usr/bin/env bash
# ============================================================
# create-admin.sh — Crear o restablecer el admin fundador
#
# Uso interactivo:
#   bash infra/scripts/create-admin.sh
#
# Uso automatizado (solo CI o secret manager; no escribir secretos en historial):
#   ADMIN_PASSWORD="..." bash infra/scripts/create-admin.sh
#
# bcrypt cost 10, igual que la API B1.
# Las operaciones SQL se ejecutan como nexora_admin, nunca como runtime API.
# ============================================================

set -Eeuo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'
ok()   { printf "%b✓%b %s\n" "$GREEN" "$NC" "$1"; }
fail() { printf "%b✗%b %s\n" "$RED" "$NC" "$1" >&2; }

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

CONTAINER="${NEXORA_POSTGRES_CONTAINER:-nexora-postgres}"
DB_USER="${NEXORA_DB_ADMIN_USER:-nexora_admin}"
DB_NAME="${NEXORA_DB_NAME:-nexora_dev}"
TENANT_ID="${ADMIN_TENANT_ID:-00000000-0000-7000-8000-000000000001}"
TENANT_NAME="${ADMIN_TENANT_NAME:-Nexora}"
TENANT_SLUG="${ADMIN_TENANT_SLUG:-nexora}"
USER_ID="${ADMIN_USER_ID:-00000000-0000-7000-8000-000000000002}"
EMAIL="${ADMIN_EMAIL:-admin@nexora.local}"
ADMIN_NAME="${ADMIN_NAME:-Admin Nexora}"
BCRYPT_COST=10

printf '\n👤 create-admin.sh — Crear o restablecer admin fundador\n'
printf '%s\n' '------------------------------------------------------------'

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -qx 'true'; then
  fail "El contenedor ${CONTAINER} no está corriendo."
  exit 1
fi

if [[ -n "${ADMIN_PASSWORD:-}" ]]; then
  PASSWORD="$ADMIN_PASSWORD"
else
  if [[ ! -t 0 ]]; then
    fail "Sin terminal interactiva. Definí ADMIN_PASSWORD de forma segura."
    exit 1
  fi

  read -r -s -p 'Contraseña para el admin (12 a 72 bytes): ' PASSWORD
  printf '\n'
  read -r -s -p 'Repetí la contraseña: ' PASSWORD_CONFIRM
  printf '\n'

  if [[ "$PASSWORD" != "$PASSWORD_CONFIRM" ]]; then
    fail 'Las contraseñas no coinciden.'
    exit 1
  fi
fi

PASSWORD_BYTES="$(LC_ALL=C printf '%s' "$PASSWORD" | wc -c)"
if (( PASSWORD_BYTES < 12 )); then
  fail 'La contraseña debe tener al menos 12 bytes.'
  exit 1
fi
if (( PASSWORD_BYTES > 72 )); then
  fail 'bcrypt solo procesa 72 bytes; usá una contraseña de hasta 72 bytes.'
  exit 1
fi

printf 'Generando hash bcrypt (cost %s)...\n' "$BCRYPT_COST"
HASH="$({
  cd "$ROOT_DIR/apps/api"
  printf '%s' "$PASSWORD" | node -e '
    const bcrypt = require("bcryptjs");
    const cost = Number(process.argv[1]);
    let password = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => { password += chunk; });
    process.stdin.on("end", () => {
      process.stdout.write(bcrypt.hashSync(password, cost));
    });
  ' "$BCRYPT_COST"
})"

unset PASSWORD PASSWORD_CONFIRM ADMIN_PASSWORD

if [[ ! "$HASH" =~ ^\$2[aby]\$ ]]; then
  fail 'No se generó un hash bcrypt válido.'
  exit 1
fi
ok "Hash bcrypt generado: ${HASH:0:20}..."

printf 'Insertando tenant y usuario en una única transacción...\n'
docker exec -i "$CONTAINER" \
  psql -X -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -v tenant_id="$TENANT_ID" \
  -v tenant_name="$TENANT_NAME" \
  -v tenant_slug="$TENANT_SLUG" \
  -v user_id="$USER_ID" \
  -v admin_email="$EMAIL" \
  -v admin_name="$ADMIN_NAME" \
  -v password_hash="$HASH" <<'SQL'
BEGIN;

INSERT INTO public.tenants (id, name, slug)
VALUES (:'tenant_id'::uuid, :'tenant_name', :'tenant_slug')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name;

INSERT INTO public.users (
  id,
  tenant_id,
  email,
  name,
  status,
  password_hash
)
SELECT
  :'user_id'::uuid,
  t.id,
  :'admin_email',
  :'admin_name',
  'active',
  :'password_hash'
FROM public.tenants t
WHERE t.slug = :'tenant_slug'
ON CONFLICT (email) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    name = EXCLUDED.name,
    password_hash = EXCLUDED.password_hash,
    status = 'active';

COMMIT;

SELECT
  u.email,
  u.name,
  u.status,
  t.name AS tenant_name
FROM public.users u
JOIN public.tenants t ON t.id = u.tenant_id
WHERE u.email = :'admin_email';
SQL

unset HASH

printf '%s\n' '------------------------------------------------------------'
ok 'Usuario admin creado o actualizado'
printf '  Email:  %s\n' "$EMAIL"
printf '  Tenant: %s (%s)\n' "$TENANT_NAME" "$TENANT_ID"
printf '  La contraseña no se imprime ni se guarda en el script.\n\n'
