# tests/integration/

Pruebas de interacción **entre servicios** (p. ej. n8n → Postgres, apps/api →
Qdrant) que no pertenecen a un solo paquete. Los tests unitarios de cada
paquete van junto a su código (`apps/api/src/**/*.test.ts`), no acá.

Vacía a propósito en el sub-proyecto 1 — se completa a medida que existan
servicios reales para probar (sub-proyecto 2 en adelante).
