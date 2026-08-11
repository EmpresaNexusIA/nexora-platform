-- ============================================================
--  Migración 0003 — A3-chiquito: la era de las acciones supervisadas
--  🧔 EL ENCARGADO aprende a actuar (con aprobación humana).
--
--  Qué trae:
--   1. orchestrator.dead_letter_queue += resolved_at, resolved_action
--      (enterrar NUNCA borra: la autopsia queda; se marca resuelto)
--   2. audit.empleado_acciones (nueva, append-only): el PRONTUARIO
--      del Empleado #0. Guarda acción, qué evento, quién la aprobó,
--      CUÁNDO y — clave de la review — el RESULTADO posterior:
--      EXITO / FRACASO / NULL (pendiente de verificar).
--      La graduación a A2 se gana con prontuario: cuenta EXITOS reales
--      (evento completado tras el reintento), no "el fundador dijo sí".
--   3. Índice parcial para las acciones pendientes de verificar.
--
--  Idempotente (IF NOT EXISTS / DO), con statement-breakpoints.
--  Diseñada para la PRUEBA DE ORO: clon vacío + migraciones = maquinaria.
-- ============================================================

--> statement-breakpoint
ALTER TABLE orchestrator.dead_letter_queue
  ADD COLUMN IF NOT EXISTS resolved_at    timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_action text;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS audit.empleado_acciones (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accion                text NOT NULL
                        CHECK (accion IN ('BURIED', 'RETRIED')),
  dlq_id                uuid NOT NULL,
  original_event_id     uuid NOT NULL,
  event_type            text NOT NULL,
  detalle               text,
  ejecutada_por         text NOT NULL DEFAULT 'fundador',
  created_at            timestamptz NOT NULL DEFAULT now(),
  -- Resultado de la acción (review: la graduación mide RESULTADO, no aprobación):
  resultado             text
                        CHECK (resultado IN ('EXITO', 'FRACASO')),
  resultado_detalle     text,
  resultado_verificado_at timestamptz
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_empleado_acciones_resultado_pendiente
  ON audit.empleado_acciones (created_at)
  WHERE resultado IS NULL;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_empleado_acciones_dlq
  ON audit.empleado_acciones (dlq_id);
