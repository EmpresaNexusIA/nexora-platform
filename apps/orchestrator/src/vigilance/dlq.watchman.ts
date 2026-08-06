import { Pool } from 'pg';

interface LoggerLike {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
}

export interface DeadLetterSighting {
  id: string;
  eventType: string;
  errorCategory: string;
  failedAt: Date;
}

/**
 * 👁️ El Ojo — Empleado #0, fase A1.
 *
 * Cada `intervalMs` mira la mesa de autopsias (orchestrator.dead_letter_queue):
 *   - 0 muertos          → silencio (la paz reina).
 *   - muertos NUEVOS (vs. última ronda) → LADRIDO (logger.warn) con el
 *     resumen de los últimos 5 (tipo de evento, causa, cuándo).
 *
 * REGLA A1: MIRA Y AVISA. Nunca escribe, nunca limpia, nunca reintenta
 * (tocar la DLQ es A2; curar es A3).
 */
export class DlQWatchman {
  private timer: NodeJS.Timeout | null = null;
  private lastSeenCount = 0;

  constructor(
    private readonly db: Pool,
    private readonly logger: LoggerLike,
    private readonly intervalMs: number = 300_000 // 5 minutos
  ) {}

  /** Arranca la vigilancia periódica (idempotente: dos start no duplican). */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.checkOnce().catch((err) =>
        this.logger.warn('[DlqWatchman] ronda falló (reintenta la próxima)', {
          error: String(err),
        })
      );
    }, this.intervalMs);
    this.logger.info('[DlqWatchman] 👁️ en vigilancia', { cadaMs: this.intervalMs });
  }

  /** Detiene la vigilancia (apagado limpio). */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Una ronda de vigilancia. Devuelve la cuenta actual de muertos. */
  async checkOnce(): Promise<number> {
    const countRes = await this.db.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM orchestrator.dead_letter_queue'
    );
    const current = Number(countRes.rows[0]?.count ?? '0');

    if (current > this.lastSeenCount) {
      const latest = await this.db.query<DeadLetterSighting>(
        `SELECT id,
                event_type     AS "eventType",
                error_category AS "errorCategory",
                failed_at      AS "failedAt"
         FROM orchestrator.dead_letter_queue
         ORDER BY failed_at DESC
         LIMIT 5`
      );
      this.logger.warn('[DlqWatchman] 🚨 MUERTO(S) NUEVO(S) en la DLQ', {
        total: current,
        nuevos: current - this.lastSeenCount,
        ultimos: latest.rows,
      });
    }

    this.lastSeenCount = current;
    return current;
  }
}
