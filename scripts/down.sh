#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/compose.yaml"

if [ -d "$ROOT_DIR/secrets" ]; then
  set -a
  for env_file in "$ROOT_DIR"/secrets/*.env; do
    [ -f "$env_file" ] && source "$env_file"
  done
  set +a
fi

if [ "$#" -eq 0 ]; then
  docker compose -f "$COMPOSE_FILE" down
else
  docker compose -f "$COMPOSE_FILE" stop "$1"
fi
