import { Pool } from 'pg';
import { TelegramNotifier } from './telegram.notifier.js';

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
 * 👁️ El Ojo v3 — Empleado #0, fase A1 (canal Telegram A1.1 enchufado).
 *
 * Cada `intervalMs` mira la mesa de autopsias (orchestrator.dead_letter_queue):
 *   - 0 muertos          → silencio (la paz reina).
 *   - muertos NUEVOS (vs. última ronda) → LADRIDO local (logger.warn) y,
 *     si hay mensajero, AVISO POR TELEGRAM al bolsillo del fundador 📱.
 *
 * v3 (A3, 10/8): solo cuenta muertos NO resueltos (resolved_at IS NULL).
 * Antes contaba todos, y un muerto enterrado por el Encargado seguía
 * inflando el pulso — el cementerio mentía. Ahora el Ojo y la mesa
 * hablan el mismo idioma.
 *
 * REGLA A1: MIRA Y AVISA. Nunca escribe, nunca limpia (eso es A2/A3).
 * Si Telegram falla, no pasa nada: el ladrido local quedó.
 */
export class DlQWatchman {
  private timer: NodeJS.Timeout | null = null;
  private lastSeenCount = 0;

  constructor(
    private readonly db: Pool,
    private readonly logger: LoggerLike,
    private readonly intervalMs: number = 300_000,
    private readonly notifier: TelegramNotifier | null = null
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
    this.logger.info('[DlqWatchman] 👁️ en vigilancia', {
      cadaMs: this.intervalMs,
      telegram: this.notifier ? 'on' : 'mudo',
    });
  }

  /** Detiene la vigilancia (apagado limpio). */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Una ronda de vigilancia. Devuelve la cuenta actual de muertos SIN resolver. */
  async checkOnce(): Promise<number> {
    const countRes = await this.db.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM orchestrator.dead_letter_queue
        WHERE resolved_at IS NULL`
    );
    const current = Number(countRes.rows[0]?.count ?? '0');

    if (current > this.lastSeenCount) {
      const latest = await this.db.query<DeadLetterSighting>(
        `SELECT id,
                event_type     AS "eventType",
                error_category AS "errorCategory",
                failed_at      AS "failedAt"
         FROM orchestrator.dead_letter_queue
         WHERE resolved_at IS NULL
         ORDER BY failed_at DESC
         LIMIT 5`
      );

      this.logger.warn('[DlqWatchman] 🚨 MUERTO(S) NUEVO(S) en la DLQ', {
        total: current,
        nuevos: current - this.lastSeenCount,
        ultimos: latest.rows,
      });

      if (this.notifier) {
        const u = latest.rows[0];
        const texto = [
          '🚨 NEXORA — Muerto(s) en la DLQ',
          `Total: ${current} · Nuevos: ${current - this.lastSeenCount}`,
          `Último: ${u?.eventType ?? '-'} · ${u?.errorCategory ?? '-'}`,
        ].join('\n');
        this.notifier.send(texto).catch((err) =>
          this.logger.warn('[DlqWatchman] aviso Telegram falló (el ladrido local quedó)', {
            error: String(err),
          })
        );
      }
    }

    this.lastSeenCount = current;
    return current;
  }
}
