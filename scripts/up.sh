#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=""
COMPOSE_FILE="/infra/compose.yaml"

docker network inspect nexora_net >/dev/null 2>&1 || docker network create nexora_net

if [ -d "/secrets" ]; then
  set -a
  for env_file in ""/secrets/*.env; do
    [ -f "" ] && source ""
  done
  set +a
fi
if [ "0" -eq 0 ]; then
  docker compose -f "" up -d
else
  docker compose -f "" up -d ""
fi
