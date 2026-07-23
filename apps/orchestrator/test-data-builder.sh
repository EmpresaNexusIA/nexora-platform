#!/bin/bash

# --- Configuración de DB ---
DB_URL="postgresql://postgres:postgres@localhost:5432/nexora"

# --- Helpers de Inserción ---
create_event() {
    local type=$1
    local id=$(uuidgen)
    psql "$DB_URL" -c "INSERT INTO audit.outbox (id, event_type, payload, status) VALUES ('$id', '$type', '{\"data\": \"test\"}', 'PENDING');" > /dev/null
    echo "$id"
}

# --- Helpers de Aserción ---
assert_status() {
    local id=$1
    local expected_status=$2
    local actual=$(psql "$DB_URL" -t -c "SELECT status FROM audit.outbox WHERE id = '$id';" | tr -d '[:space:]')
    if [ "$actual" != "$expected_status" ]; then
        echo "❌ Aserción fallida para $id: esperado $expected_status, obtenido $actual"
        exit 1
    fi
    echo "✅ Evento $id confirmado en estado $expected_status"
}

assert_dead_letter() {
    local event_id=$1
    local count=$(psql "$DB_URL" -t -c "SELECT count(*) FROM orchestrator.dead_letter_queue WHERE original_event_id = '$event_id';" | tr -d '[:space:]')
    if [ "$count" != "1" ]; then
        echo "❌ Evento $event_id no encontrado en DLQ"
        exit 1
    fi
    echo "✅ Evento $event_id verificado en DLQ"
}
