#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

VOLUMES="$(docker volume ls --format '{{.Name}}' --filter 'name=nexora_')"

if [ -z "$VOLUMES" ]; then
  echo "No hay volúmenes con prefijo nexora_ para respaldar."
  exit 0
fi

for VOLUME in $VOLUMES; do
  echo "Respaldando $VOLUME..."
  docker run --rm \
    -v "$VOLUME":/data:ro \
    -v "$BACKUP_DIR":/backup \
    alpine \
    tar czf "/backup/${VOLUME}-${TIMESTAMP}.tar.gz" -C /data .
done

echo "Backups guardados en $BACKUP_DIR"
