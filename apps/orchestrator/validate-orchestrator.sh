#!/bin/bash
source ./test-data-builder.sh

echo "[SP3 Suite] Iniciando validación de resiliencia..."

# Test 1: Evento exitoso
ID1=$(create_event "test.success")
sleep 2 # Esperar al worker
assert_status "$ID1" "COMPLETED"

# Test 2: Evento a DLQ (Permanent Error)
# Nota: Para probar esto, inyectaremos un evento que provoque un error categórico
ID2=$(create_event "test.permanent_error")
sleep 2
assert_dead_letter "$ID2"

echo "✅ Suite SP3 completa: Todas las validaciones pasaron."
