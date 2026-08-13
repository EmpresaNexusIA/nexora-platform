#!/usr/bin/env bash
# ============================================================
#  🔐 verificar-entrega.sh — Verificador de hash de entregas
#
#  Antes de copiar un archivo descargado de Descargas al repo,
#  verifica que su sha256 matchee el esperado. Si no matchea,
#  avisa y NO copia — evita que se pegue un archivo viejo.
#
#  Después de copiar con éxito, BORRA el original de Descargas
#  para que no se acumule ni se confunda después (patrón
#  "Descargas viejas" — ADDENDUM 24).
#
#  Si el hash NO matchea, NO borra (para que puedas re-descargar).
#
#  USO:
#    verificar-entrega.sh <archivo> <hash-esperado> <destino>
#
#  EJEMPLO:
#    verificar-entrega.sh ~/Descargas/0005_grant.sql \
#      abc123... ~/dev/nexora-platform/packages/database/migrations/0005.sql
#
#  El hash se calcula SIEMPRE sobre el archivo que está en Descargas.
#  Si el archivo no existe o el hash no matchea, no se copia nada.
# ============================================================

set -euo pipefail

# ---------- Colores ----------
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ok()   { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️${NC} $1"; }

# ---------- Validar argumentos ----------
if [ $# -ne 3 ]; then
  echo ""
  echo "🔐 verificar-entrega.sh — Verificador de hash de entregas"
  echo ""
  echo "USO:"
  echo "  verificar-entrega.sh <archivo> <hash-esperado> <destino>"
  echo ""
  echo "EJEMPLO:"
  echo "  verificar-entrega.sh ~/Descargas/migracion.sql abc123... ~/dev/repo/migracion.sql"
  echo ""
  echo "Después de copiar con éxito, borra el original (limpieza automática)."
  exit 1
fi

ARCHIVO="$1"
HASH_ESPERADO="$2"
DESTINO="$3"

echo ""
echo "🔐 verificar-entrega.sh"
echo "------------------------------------------------------------"

# ---------- 1. ¿Existe el archivo? ----------
if [ ! -f "$ARCHIVO" ]; then
  fail "El archivo no existe: $ARCHIVO"
  fail "¿Lo descargaste a la carpeta correcta?"
  exit 1
fi

ok "Archivo encontrado: $ARCHIVO"

# ---------- 2. Calcular hash real ----------
HASH_REAL=$(sha256sum "$ARCHIVO" | awk '{print $1}')
ok "Hash calculado:  ${HASH_REAL:0:16}..."

# ---------- 3. Comparar ----------
if [ "$HASH_REAL" != "$HASH_ESPERADO" ]; then
  echo "------------------------------------------------------------"
  fail "HASH NO COINCIDE — el archivo es VIEJO o está corrupto"
  echo ""
  echo "  Esperado: $HASH_ESPERADO"
  echo "  Real:     $HASH_REAL"
  echo ""
  warn "NO se copió nada. Re-descargá el archivo e intentá de nuevo."
  echo "------------------------------------------------------------"
  exit 1
fi

ok "Hash correcto ✓"

# ---------- 4. Copiar ----------
cp "$ARCHIVO" "$DESTINO"
ok "Copiado a: $DESTINO"

# ---------- 5. Verificar que el destino tiene el mismo hash ----------
HASH_DESTINO=$(sha256sum "$DESTINO" | awk '{print $1}')
if [ "$HASH_DESTINO" != "$HASH_REAL" ]; then
  fail "ERROR: el hash del destino no coincide después de copiar"
  fail "Algo salió mal en la copia. El original NO se borra."
  exit 1
fi
ok "Hash en destino verificado ✓"

# ---------- 6. Limpiar el original de Descargas ----------
rm "$ARCHIVO"
ok "Original borrado de Descargas (limpieza automática) 🧹"

echo "------------------------------------------------------------"
ok "Entrega verificada, copiada y limpia. Listo."
echo ""
echo "Hash en destino: $HASH_DESTINO"
echo ""
