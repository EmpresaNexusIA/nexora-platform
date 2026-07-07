#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Uso: update-service.sh <servicio>" >&2
  exit 1
fi

SERVICE="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/compose.yaml"

if [ -d "$ROOT_DIR/secrets" ]; then
  set -a
  for env_file in "$ROOT_DIR"/secrets/*.env; do
    [ -f "$env_file" ] && source "$env_file"
  done
  set +a
fi

docker compose -f "$COMPOSE_FILE" pull "$SERVICE"
docker compose -f "$COMPOSE_FILE" up -d --no-deps "$SERVICE"
