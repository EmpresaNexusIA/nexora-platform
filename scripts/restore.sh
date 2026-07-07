#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Uso: restore.sh <volumen> <archivo_backup.tar.gz>" >&2
  exit 1
fi

VOLUME="$1"
BACKUP_FILE="$2"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "No existe el archivo $BACKUP_FILE" >&2
  exit 1
fi

docker volume inspect "$VOLUME" >/dev/null 2>&1 || docker volume create "$VOLUME"

docker run --rm \
  -v "$VOLUME":/data \
  -v "$(cd "$(dirname "$BACKUP_FILE")" && pwd)":/backup \
  alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/$(basename "$BACKUP_FILE") -C /data"

echo "Volumen $VOLUME restaurado desde $BACKUP_FILE"
