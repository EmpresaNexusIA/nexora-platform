import { Logger } from './logger.js';
import { MetricsCollector } from './metrics.collector.js';
import { EventDispatcher } from './event.dispatcher.js';
import { IdempotencyService } from '../services/idempotency.service.js';
import { OutboxEvent } from '../types/outbox.types.js';

/**
 * Evento tal como viaja por el procesador F3 (2026-08-07):
 * el OutboxEvent canonico + el tenantId que el Worker le funde
 * encima via CorrelationContext (audit.outbox no tiene esa columna).
 */
type EventoProcesable = OutboxEvent & { tenantId?: string };

export class EventProcessor {

  constructor(
    private readonly logger: Logger,
    private readonly metrics: MetricsCollector,
    private readonly dispatcher: EventDispatcher,
    private readonly idempotency: IdempotencyService
  ) {}

  async process(event: EventoProcesable): Promise<void> {
    const startTime = Date.now();

    // FIX SP3: handler se lee de event.eventType (el campo real del OutboxEvent,
    // ver types/outbox.types.ts) y tenantId se deriva del payload, porque
    // audit.outbox no tiene columna tenant_id de primer nivel.
    const context = {
      eventId: event.id,
      tenantId: event.tenantId ?? event.payload?.tenantId,
      handler: event.eventType
    };

    try {
      this.metrics.incrementProcessed();

      // Idempotencia canónica (services/ + repositories/): clave (event_id, handler_name)
      // sobre orchestrator.idempotency_keys, con ON CONFLICT por la unique compuesta.
      const handlerName =
        this.dispatcher.getHandlerName(event.eventType) ?? event.eventType;
      const isNew = await this.idempotency.isUniqueAndRegister(event, handlerName);

      if (!isNew) {
        this.logger.warn('Evento duplicado detectado, omitiendo.', context);
        return;
      }

      await this.dispatcher.dispatch(event);
      this.metrics.incrementSuccess();

      this.logger.info('Evento procesado exitosamente.', {
        ...context,
        durationMs: Date.now() - startTime
      });

    } catch (error: unknown) {
      // v2 (12/8): deuda fina saldada — `any` → `unknown` con conversión segura.
      // El logger.error exige un Error real; si lo que se lanzó no lo es,
      // se envuelve sin perder el original (se re-lanza tal cual abajo).
      this.metrics.incrementFailure();
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error procesando evento.', err, context);
      throw error;
    }
  }
}
