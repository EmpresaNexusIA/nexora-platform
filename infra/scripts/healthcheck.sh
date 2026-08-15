#!/usr/bin/env bash
# ============================================================
#  🩺 healthcheck.sh — EMPLEADO #0 · NEXORA
#  El médico de guardia: 10 chequeos en ~35 segundos.
#  Filosofía: MIRAR E INFORMAR (cero riesgo).
#  Única acción permitida: auto-curar traefik caído (el mantra).
#  v4 (F5 Qdrant): ¡LA FAMILIA COMPLETA! 6 contenedores
#                  esperados (se suma nexora-qdrant) + chequeo 10.
#  v5 (A3, 10/8):  el pulso cuenta la DLQ SOLO sin resolver
#                  (resolved_at IS NULL) — los enterrados por el
#                  Encargado ya no inflan el cementerio. PULSO_ESPERADO
#                  pasa a 3|0|6|6|4 cuando la migración 0003 quede
#                  registrada en el journal (commit final del A3).
#  v3 (F5 MinIO):  familia de 5 + chequeo 9: MinIO health/live.
#  v2 (F5 Redis):  familia de 4 + chequeo 8: Redis PONG.
#  Uso:   bash healthcheck.sh
#  Salida: ✓/✗ por órgano + exit code = nº de fallas (0 = sano).
# ============================================================

set -u

# ---- Verdades del organismo (solo cambian tras un transplante) ----
DNI_ESPERADO="7670634338808201248"
PULSO_ESPERADO="3|0|6|7|9"  # pulso tras 0008 (B1 auth + hardening login)
ESPERADOS="nexora-postgres nexora_traefik nexora_whoami nexora-redis nexora-minio nexora-qdrant"

OKS=0
FALLAS=0
tildar() { echo "✓ $1"; OKS=$((OKS+1)); }
cruzar() { echo "✗ $1"; FALLAS=$((FALLAS+1)); }

echo ""
echo "🩺 NEXORA — Chequeo de salud ($(date "+%Y-%m-%d %H:%M"))"
echo "------------------------------------------------------------"

# ---- 1. Motor Docker -------------------------------------------------
if docker ps >/dev/null 2>&1; then
  tildar "1. Motor Docker: vivo"
else
  cruzar "1. Motor Docker: NO responde — probar: sudo systemctl start docker"
fi

# ---- Auto-cura: si traefik existe pero duerme, va el mantra ----------
if docker ps -a --format "{{.Names}}" 2>/dev/null | grep -qx "nexora_traefik" \
&& ! docker ps --format "{{.Names}}" 2>/dev/null | grep -qx "nexora_traefik"; then
  echo "🩹 Traefik dormido → aplico el mantra (docker start nexora_traefik)…"
  docker start nexora_traefik >/dev/null 2>&1
  sleep 3
fi

# ---- 2. Los 6 y solo los 6 (REGLA MUSEO + familia F5 completa) -------
FALTAN=""
for C in $ESPERADOS; do
  docker ps --format "{{.Names}}" 2>/dev/null | grep -qx "$C" || FALTAN="$FALTAN $C"
done
EXTRAS=$(comm -13 <(printf "%s\n" $ESPERADOS | sort) \
                 <(docker ps --format "{{.Names}}" 2>/dev/null | sort) | tr "\n" " ")
if [ -z "$FALTAN" ]; then
  if [ -z "$EXTRAS" ]; then
    tildar "2. Contenedores: los 6 y solo los 6 (museo respetado)"
  else
    tildar "2. Contenedores: los 6 arriba (⚠ ojo, extra(s) corriendo:$EXTRAS)"
  fi
else
  cruzar "2. Faltan contenedores:$FALTAN"
fi

# ---- 3. Postgres por dentro (pg_isready) ------------------------------
if docker exec nexora-postgres pg_isready -U nexora_admin >/dev/null 2>&1; then
  tildar "3. Postgres por dentro: acepta conexiones (no solo el contenedor)"
else
  cruzar "3. Postgres por dentro: no responde o sigue arrancando"
fi

# ---- 4. DNI del organismo ---------------------------------------------
DNI=$(docker exec -i nexora-postgres psql -U nexora_admin -d postgres -t -A \
      -c "select system_identifier from pg_control_system()" 2>/dev/null)
if [ "$DNI" = "$DNI_ESPERADO" ]; then
  tildar "4. DNI del organismo: coincide ($DNI)"
else
  cruzar "4. DNI distinto: [$DNI] ≠ [$DNI_ESPERADO] — ¿organismo impostor?"
fi

# ---- 5. Pulso sagrado ---------------------------------------------------
PULSO=$(docker exec -i nexora-postgres psql -U nexora_admin -d nexora_dev -t -A \
      -c "select (select count(*) from audit.outbox), (select count(*) from orchestrator.dead_letter_queue where resolved_at is null), (select count(*) from pg_trigger where not tgisinternal), (select count(*) from pg_policy), (select count(*) from drizzle.__drizzle_migrations)" 2>/dev/null)
if [ "$PULSO" = "$PULSO_ESPERADO" ]; then
  tildar "5. Pulso sagrado: $PULSO ✓ (memoria intacta)"
else
  cruzar "5. Pulso: [$PULSO] ≠ esperado [$PULSO_ESPERADO]"
fi

# ---- 6. La puerta web (traefik en :80) -----------------------------------
CODIGO=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost/ 2>/dev/null)
[ -z "$CODIGO" ] && CODIGO="000"
if [ "$CODIGO" != "000" ]; then
  tildar "6. Puerta web (traefik :80): responde (HTTP $CODIGO — 404 cuenta ✓)"
else
  cruzar "6. Puerta web: nadie contesta en :80"
fi

# ---- 7. Recursos (disco < 80% · RAM disponible > 1GB) --------------------
DISCO=$(df --output=pcent / 2>/dev/null | tail -1 | tr -dc "0-9")
RAMDISP=$(free -m | awk "/^Mem:/ {print \$7}")
DETALLE="disco ${DISCO:-?}% · RAM disponible ${RAMDISP:-?}MB (cache NO es problema)"
if [ "${DISCO:-100}" -lt 80 ] && [ "${RAMDISP:-0}" -gt 1024 ]; then
  tildar "7. Recursos holgados: $DETALLE"
else
  cruzar "7. Recursos justos: $DETALLE"
fi

# ---- 8. Redis por dentro (PONG con clave) --------------------------------
if docker exec nexora-redis sh -c "redis-cli --no-auth-warning -a \"\$REDIS_PASSWORD\" ping" 2>/dev/null | grep -q PONG; then
  tildar "8. Redis por dentro: PONG (el anotador responde y pide clave)"
else
  cruzar "8. Redis por dentro: no responde o falta REDIS_PASSWORD"
fi

# ---- 9. MinIO por dentro (health/live) -----------------------------------
MCODIGO=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:9000/minio/health/live 2>/dev/null)
[ -z "$MCODIGO" ] && MCODIGO="000"
if [ "$MCODIGO" = "200" ]; then
  tildar "9. MinIO por dentro: vivo y atendiendo (health/live 200)"
else
  cruzar "9. MinIO por dentro: no responde (HTTP $MCODIGO)"
fi

# ---- 10. Qdrant por dentro (healthz) ---------------------------------------
QCODIGO=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:6333/healthz 2>/dev/null)
[ -z "$QCODIGO" ] && QCODIGO="000"
if [ "$QCODIGO" = "200" ]; then
  tildar "10. Qdrant por dentro: vivo (healthz 200 — la biblioteca abre)"
else
  cruzar "10. Qdrant por dentro: no responde (HTTP $QCODIGO)"
fi

# ---- Diagnóstico final ---------------------------------------------------
echo "------------------------------------------------------------"
TOTAL=$((OKS+FALLAS))
if [ "$FALLAS" -eq 0 ]; then
  echo "💚 SALUD PERFECTA: $OKS/$TOTAL órganos sanos. Nexora respira."
else
  echo "🩺 SALUD: $OKS/$TOTAL sanos · $FALLAS con problema (mirá los ✗)."
fi
echo ""
exit "$FALLAS"
